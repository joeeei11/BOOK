// pages/profile/profile.js
const { userAPI, bookAPI, reviewAPI, orderAPI } = require('../../utils/api')
const { formatTime, formatStars, getCreditLevel, CONDITION_MAP } = require('../../utils/format')

Page({
    data: {
        userInfo: {},
        isSelf: true,
        isAdmin: false,
        creditStars: '',
        creditLevel: {},
        bookCount: 0,
        orderCount: 0,
        reviewCount: 0,
        reviews: [],
        otherBooks: [],
        conditionMap: CONDITION_MAP
    },

    async onLoad(options) {
        const app = getApp()
        let userId = options.userId || app.globalData.openid

        // 未登录时先尝试调用 login 云函数获取 openid
        if (!userId) {
            try {
                const loginRes = await app.login()
                userId = loginRes.openid
            } catch (e) {
                console.error('自动登录失败:', e)
                wx.navigateTo({ url: '/pages/login/login' })
                return
            }
        }

        if (!userId) {
            wx.navigateTo({ url: '/pages/login/login' })
            return
        }

        const isSelf = userId === app.globalData.openid

        this.setData({ isSelf, isAdmin: app.globalData.isAdmin })
        wx.showLoading({ title: '加载中...' })

        try {
            const [userInfo, reviews] = await Promise.all([
                userAPI.getUserInfo(userId),
                reviewAPI.getUserReviews(userId)
            ])

            const creditStars = formatStars(Math.min(5, Math.max(1, Math.round((userInfo.creditScore - 80) / 10))))
            const creditLevel = getCreditLevel(userInfo.creditScore)
            const reviewsWithTime = reviews.map(r => ({ ...r, createTimeStr: formatTime(r.createTime), stars: formatStars(r.score || 5) }))

            this.setData({ userInfo, creditStars, creditLevel, reviews: reviewsWithTime, reviewCount: reviews.length })

            if (isSelf) {
                // 加载统计数据
                const myBooks = await bookAPI.getMyBooks()
                const onSaleBooks = myBooks.filter(b => b.status === 'on_sale')
                const orders = await orderAPI.getBuyerOrders()
                this.setData({ bookCount: onSaleBooks.length, orderCount: orders.length })
            } else {
                // 加载对方的在售书籍
                const otherBooks = await bookAPI.getBooksBySeller(userId)
                this.setData({ otherBooks })
            }
        } catch (err) {
            console.error('加载主页失败:', err)
        } finally {
            wx.hideLoading()
        }
    },

    onShow() {
        if (this.data.isSelf) {
            const app = getApp()
            // 检查是否已完善资料
            if (app.globalData.openid && !app.globalData.userInfo?.nickName) {
                wx.navigateTo({ url: '/pages/login/login' })
                return
            }
            // 刷新用户信息（修改资料后）
            if (app.globalData.userInfo) {
                const userInfo = app.globalData.userInfo
                const creditStars = formatStars(Math.min(5, Math.max(1, Math.round((userInfo.creditScore - 80) / 10))))
                const creditLevel = getCreditLevel(userInfo.creditScore)
                this.setData({ userInfo, creditStars, creditLevel, isAdmin: app.globalData.isAdmin })
            }
        }
    },

    getStars(score) { return formatStars(score) },

    goMyBooks() { wx.navigateTo({ url: '/pages/my-books/my-books' }) },
    goMyOrders() { wx.navigateTo({ url: '/pages/my-orders/my-orders' }) },

    editProfile() {
        wx.navigateTo({ url: '/pages/login/login?mode=edit' })
    },

    goAdmin() {
        wx.navigateTo({ url: '/pages/admin/index/index' })
    },

    goBookDetail(e) {
        wx.navigateTo({ url: `/pages/book-detail/book-detail?id=${e.currentTarget.dataset.id}` })
    },

    async logout() {
        const res = await wx.showModal({ title: '确认退出登录？', confirmColor: '#F56C6C' })
        if (res.confirm) getApp().logout()
    }
})
