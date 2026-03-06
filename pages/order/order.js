// pages/order/order.js - 订单列表页
const { orderAPI, bookAPI, reviewAPI } = require('../../utils/api')
const { formatTime, formatOrderStatus } = require('../../utils/format')

Page({
    data: {
        activeTab: 'buy',
        orders: [],
        loading: true
    },

    onLoad() {
        this.loadOrders()
    },

    onShow() {
        if (!this.data.loading) {
            this.loadOrders()
        }
    },

    switchTab(e) {
        const tab = e.currentTarget.dataset.tab
        this.setData({ activeTab: tab })
        this.loadOrders()
    },

    async loadOrders() {
        this.setData({ loading: true })
        try {
            let orders
            if (this.data.activeTab === 'buy') {
                orders = await orderAPI.getBuyerOrders()
            } else {
                orders = await orderAPI.getSellerOrders()
            }

            // 为每个订单补充书籍信息和状态格式化
            const enrichedOrders = await Promise.all(orders.map(async (order) => {
                const statusInfo = formatOrderStatus(order.status)
                const createTimeStr = formatTime(order.createTime)
                let bookTitle = order.bookTitle || '书籍'
                let bookCoverImage = order.bookCoverImage || ''

                // 如果订单中没有书籍信息，尝试查询
                if (!bookTitle || bookTitle === '书籍') {
                    try {
                        const book = await bookAPI.getBookDetail(order.bookId)
                        bookTitle = book.title
                        bookCoverImage = book.images && book.images[0] ? book.images[0] : ''
                    } catch (e) { }
                }

                // 检查是否已评价
                let reviewed = false
                if (order.status === 'completed') {
                    try {
                        reviewed = await reviewAPI.hasReviewed(order._id)
                    } catch (e) { }
                }

                return { ...order, statusInfo, createTimeStr, bookTitle, bookCoverImage, reviewed }
            }))

            this.setData({ orders: enrichedOrders, loading: false })
        } catch (err) {
            console.error('加载订单失败:', err)
            this.setData({ loading: false })
            wx.showToast({ title: '加载失败', icon: 'error' })
        }
    },

    // 联系卖家
    contactSeller(e) {
        const { sellerId, bookId } = e.currentTarget.dataset
        wx.navigateTo({
            url: `/pages/chat/chat?userId=${sellerId}&bookId=${bookId}`
        })
    },

    // 联系买家
    contactBuyer(e) {
        const { buyerId, bookId } = e.currentTarget.dataset
        wx.navigateTo({
            url: `/pages/chat/chat?userId=${buyerId}&bookId=${bookId}`
        })
    },

    // 取消订单
    async cancelOrder(e) {
        const orderId = e.currentTarget.dataset.orderId
        const res = await wx.showModal({
            title: '确认取消',
            content: '确定要取消此订单吗？取消后书籍将重新上架',
            confirmColor: '#F56C6C'
        })
        if (!res.confirm) return

        wx.showLoading({ title: '处理中...' })
        try {
            const result = await orderAPI.cancelOrder(orderId)
            if (result && result.success === false) {
                wx.showToast({ title: result.error || '取消失败', icon: 'none' })
            } else {
                wx.showToast({ title: '已取消' })
                this.loadOrders()
            }
        } finally {
            wx.hideLoading()
        }
    },

    // 卖家确认卖出
    async confirmSell(e) {
        const orderId = e.currentTarget.dataset.orderId
        const res = await wx.showModal({
            title: '确认卖出',
            content: '请确认您已同意出售此书籍，确认后等待买家确认收货',
            confirmText: '确认卖出'
        })
        if (!res.confirm) return

        wx.showLoading({ title: '处理中...' })
        try {
            const result = await orderAPI.confirmOrder(orderId)
            if (result && result.success === false) {
                wx.showToast({ title: result.error || '确认失败', icon: 'none' })
            } else {
                wx.showToast({ title: '已确认卖出' })
                this.loadOrders()
            }
        } finally {
            wx.hideLoading()
        }
    },

    // 买家确认收货
    async confirmReceive(e) {
        const { orderId, bookId } = e.currentTarget.dataset
        const res = await wx.showModal({
            title: '确认收货',
            content: '请确认您已收到书籍，确认后订单将完成',
            confirmText: '确认收货'
        })
        if (!res.confirm) return

        wx.showLoading({ title: '处理中...' })
        try {
            const result = await orderAPI.completeOrder(orderId, bookId)
            if (result && result.success === false) {
                wx.showToast({ title: result.error || '确认失败', icon: 'none' })
            } else {
                wx.showToast({ title: '交易完成！' })
                this.loadOrders()
            }
        } finally {
            wx.hideLoading()
        }
    },

    // 跳转评价
    goReview(e) {
        const { orderId, revieweeId } = e.currentTarget.dataset
        wx.navigateTo({
            url: `/pages/review/review?orderId=${orderId}&revieweeId=${revieweeId}`
        })
    },

    // 跳转书籍详情
    goBookDetail(e) {
        const id = e.currentTarget.dataset.id
        wx.navigateTo({ url: `/pages/book-detail/book-detail?id=${id}` })
    }
})
