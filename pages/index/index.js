// pages/index/index.js - 首页
const { bookAPI } = require('../../utils/api')
const { COLLEGES, CONDITION_MAP } = require('../../utils/format')

Page({
    data: {
        books: [],
        colleges: COLLEGES,
        selectedCollege: '',
        loading: true,
        loadingMore: false,
        hasMore: true,
        page: 1,
        pageSize: 10,
        conditionMap: CONDITION_MAP
    },

    onLoad() {
        this.loadBooks(true)
    },

    onShow() {
        // 检查用户是否已完善资料
        const app = getApp()
        if (app.globalData.openid && !app.ensureProfile()) return

        // 返回首页时刷新列表（比如发布了新书）
        if (!this.data.loading) {
            this.loadBooks(true)
        }
    },

    // 下拉刷新
    onPullDownRefresh() {
        this.loadBooks(true).finally(() => {
            wx.stopPullDownRefresh()
        })
    },

    // 上拉加载更多
    onReachBottom() {
        if (!this.data.hasMore || this.data.loadingMore) return
        this.loadBooks(false)
    },

    // 加载书籍列表
    async loadBooks(isRefresh = false) {
        if (isRefresh) {
            this.setData({ page: 1, hasMore: true, loading: true })
        } else {
            this.setData({ loadingMore: true })
        }

        try {
            const books = await bookAPI.getBooks({
                college: this.data.selectedCollege,
                page: isRefresh ? 1 : this.data.page,
                pageSize: this.data.pageSize
            })

            const hasMore = books.length === this.data.pageSize

            if (isRefresh) {
                this.setData({ books, loading: false, hasMore, page: 2 })
            } else {
                this.setData({
                    books: [...this.data.books, ...books],
                    loadingMore: false,
                    hasMore,
                    page: this.data.page + 1
                })
            }
        } catch (err) {
            console.error('加载书籍失败:', err)
            wx.showToast({ title: '加载失败', icon: 'error' })
            this.setData({ loading: false, loadingMore: false })
        }
    },

    // 学院筛选
    filterCollege(e) {
        const college = e.currentTarget.dataset.college
        this.setData({ selectedCollege: college })
        this.loadBooks(true)
    },

    // 跳转搜索页
    goSearch() {
        wx.navigateTo({ url: '/pages/search/search' })
    },

    // 跳转书籍详情
    goBookDetail(e) {
        const id = e.currentTarget.dataset.id
        wx.navigateTo({ url: `/pages/book-detail/book-detail?id=${id}` })
    },

    // 跳转发布页
    goPublish() {
        wx.switchTab({ url: '/pages/publish/publish' })
    }
})
