// pages/book-detail/book-detail.js
const { bookAPI, userAPI, orderAPI } = require('../../utils/api')
const { formatTime, formatStars, CONDITION_MAP } = require('../../utils/format')

Page({
    data: {
        bookId: '',
        book: {},
        seller: null,
        isMine: false,
        publishTime: '',
        creditStars: '',
        conditionMap: CONDITION_MAP
    },

    async onLoad(options) {
        const { id } = options
        if (!id) { wx.navigateBack(); return }
        this.setData({ bookId: id })
        wx.showLoading({ title: '加载中...' })
        try {
            await this.loadBook(id)
        } catch (err) {
            console.error('加载书籍详情失败:', err)
            wx.showToast({ title: '加载失败，请检查网络或云函数是否部署', icon: 'none', duration: 3000 })
        } finally {
            wx.hideLoading()
        }
    },

    async loadBook(id) {
        const book = await bookAPI.getBookDetail(id)
        if (!book) { wx.showToast({ title: '书籍不存在或已下架', icon: 'error' }); return }

        // 增加浏览量（异步，不影响主流程）
        bookAPI.incrementView(id).catch(() => { })

        const app = getApp()
        const isMine = book.sellerId === app.globalData.openid
        const publishTime = formatTime(book.createTime)

        this.setData({ book, isMine, publishTime })

        // 加载卖家信息
        if (!isMine && book.sellerId) {
            try {
                const seller = await userAPI.getUserInfo(book.sellerId)
                if (seller) {
                    const creditStars = formatStars(Math.min(5, Math.max(1, Math.round(((seller.creditScore || 100) - 80) / 10))))
                    this.setData({ seller, creditStars })
                }
            } catch (e) {
                console.warn('加载卖家信息失败:', e)
            }
        }
    },

    // 预览图片
    previewImage(e) {
        const index = e.currentTarget.dataset.index
        wx.previewImage({
            current: this.data.book.images[index],
            urls: this.data.book.images
        })
    },

    // 联系卖家
    contactSeller() {
        const app = getApp()
        if (!app.globalData.openid) {
            wx.showToast({ title: '请先登录', icon: 'none' })
            wx.navigateTo({ url: '/pages/login/login' })
            return
        }
        const { book } = this.data
        if (!book.sellerId) {
            wx.showToast({ title: '卖家信息异常', icon: 'none' })
            return
        }
        const sellerName = this.data.seller ? (this.data.seller.nickName || '') : ''
        wx.navigateTo({
            url: `/pages/chat/chat?userId=${book.sellerId}&bookId=${this.data.bookId}&bookTitle=${encodeURIComponent(book.title || '')}&nickName=${encodeURIComponent(sellerName)}`
        })
    },

    // 创建订单
    async createOrder() {
        const { book, bookId } = this.data
        const app = getApp()

        if (!app.globalData.openid) {
            wx.showToast({ title: '请先登录', icon: 'none' })
            wx.navigateTo({ url: '/pages/login/login' })
            return
        }

        if (!bookId || !book.sellerId) {
            wx.showToast({ title: '书籍信息异常', icon: 'error' })
            return
        }

        const result = await wx.showModal({
            title: '确认购买',
            content: `《${book.title}》￥${book.price}\n确认后将通知卖家`,
            confirmText: '确认购买'
        })
        if (!result.confirm) return

        wx.showLoading({ title: '提交中...' })
        try {
            const res = await orderAPI.createOrder({
                bookId: bookId,
                sellerId: book.sellerId,
                price: Number(book.price)
            })
            if (res.success) {
                wx.showToast({ title: '已发送购买意向！' })
                // 跳转到订单详情
                setTimeout(() => {
                    wx.navigateTo({ url: `/pages/order/order?id=${res.orderId}` })
                }, 1500)
            } else {
                wx.showToast({ title: res.error || '操作失败', icon: 'error' })
            }
        } finally {
            wx.hideLoading()
        }
    },

    // 查看卖家主页
    goSellerProfile() {
        wx.navigateTo({ url: `/pages/profile/profile?userId=${this.data.book.sellerId}` })
    },

    // 编辑书籍
    editBook() {
        wx.navigateTo({ url: `/pages/edit-book/edit-book?id=${this.data.bookId}` })
    },

    // 下架书籍
    async withdrawBook() {
        const result = await wx.showModal({
            title: '确认下架',
            content: '下架后此书不再对外展示，确认下架吗？',
            confirmColor: '#F56C6C'
        })
        if (!result.confirm) return

        wx.showLoading({ title: '处理中...' })
        try {
            await bookAPI.withdrawBook(this.data.bookId)
            wx.showToast({ title: '已下架' })
            setTimeout(() => wx.navigateBack(), 1500)
        } finally {
            wx.hideLoading()
        }
    }
})
