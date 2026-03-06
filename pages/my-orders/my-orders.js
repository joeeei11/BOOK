// pages/my-orders/my-orders.js - 我的订单（与order页面类似但从profile进入）
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
        if (!this.data.loading) this.loadOrders()
    },

    switchTab(e) {
        this.setData({ activeTab: e.currentTarget.dataset.tab })
        this.loadOrders()
    },

    async loadOrders() {
        this.setData({ loading: true })
        try {
            let orders = this.data.activeTab === 'buy'
                ? await orderAPI.getBuyerOrders()
                : await orderAPI.getSellerOrders()

            const enriched = await Promise.all(orders.map(async order => {
                const statusInfo = formatOrderStatus(order.status)
                const createTimeStr = formatTime(order.createTime)
                let bookTitle = '书籍', bookCoverImage = ''
                try {
                    const book = await bookAPI.getBookDetail(order.bookId)
                    bookTitle = book.title
                    bookCoverImage = book.images?.[0] || ''
                } catch (e) { }

                let reviewed = false
                if (order.status === 'completed') {
                    try { reviewed = await reviewAPI.hasReviewed(order._id) } catch (e) { }
                }
                return { ...order, statusInfo, createTimeStr, bookTitle, bookCoverImage, reviewed }
            }))

            this.setData({ orders: enriched, loading: false })
        } catch (err) {
            console.error('加载订单失败:', err)
            this.setData({ loading: false })
        }
    },

    contactSeller(e) {
        const { sellerId, bookId } = e.currentTarget.dataset
        wx.navigateTo({ url: `/pages/chat/chat?userId=${sellerId}&bookId=${bookId}` })
    },

    contactBuyer(e) {
        const { buyerId, bookId } = e.currentTarget.dataset
        wx.navigateTo({ url: `/pages/chat/chat?userId=${buyerId}&bookId=${bookId}` })
    },

    async cancelOrder(e) {
        const res = await wx.showModal({ title: '确认取消', content: '确定取消此订单？取消后书籍将重新上架', confirmColor: '#F56C6C' })
        if (!res.confirm) return
        wx.showLoading({ title: '处理中...' })
        try {
            const result = await orderAPI.cancelOrder(e.currentTarget.dataset.orderId)
            if (result && result.success === false) {
                wx.showToast({ title: result.error || '取消失败', icon: 'none' })
            } else {
                wx.showToast({ title: '已取消' })
                this.loadOrders()
            }
        } finally { wx.hideLoading() }
    },

    async confirmSell(e) {
        const orderId = e.currentTarget.dataset.orderId
        const res = await wx.showModal({ title: '确认卖出', content: '确认后等待买家确认收货', confirmText: '确认卖出' })
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
        } finally { wx.hideLoading() }
    },

    async confirmReceive(e) {
        const { orderId, bookId } = e.currentTarget.dataset
        const res = await wx.showModal({ title: '确认收货', content: '确认已收到书籍，订单将完成', confirmText: '确认收货' })
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
        } finally { wx.hideLoading() }
    },

    goReview(e) {
        const { orderId, revieweeId } = e.currentTarget.dataset
        wx.navigateTo({ url: `/pages/review/review?orderId=${orderId}&revieweeId=${revieweeId}` })
    },

    goBookDetail(e) {
        wx.navigateTo({ url: `/pages/book-detail/book-detail?id=${e.currentTarget.dataset.id}` })
    }
})
