// pages/message/message.js - 微信风格消息列表页
const { messageAPI } = require('../../utils/api')
const { formatChatTime } = require('../../utils/format')

Page({
    data: {
        conversations: [],
        filteredConversations: [],
        loading: true,
        unreadTotal: 0,
        searchKeyword: '',
        // 左滑相关
        _touchStartX: 0,
        _touchStartY: 0,
        _currentSlideIndex: -1
    },

    onShow() {
        this.loadConversations()
    },

    async loadConversations() {
        this.setData({ loading: true })
        try {
            const conversations = await messageAPI.getConversations()
            const enriched = conversations.map(conv => ({
                ...conv,
                lastMsgPreview: this.getMessagePreview(conv.lastMsg),
                lastMsgTime: conv.lastMsg ? formatChatTime(conv.lastMsg.createTime) : '',
                slideX: 0
            }))
            const unreadTotal = enriched.reduce((sum, c) => sum + (c.unread || 0), 0)

            this.setData({
                conversations: enriched,
                filteredConversations: this.filterConversations(enriched, this.data.searchKeyword),
                loading: false,
                unreadTotal
            })

            // 更新tabBar未读数
            if (unreadTotal > 0) {
                wx.setTabBarBadge({ index: 2, text: unreadTotal > 99 ? '99+' : String(unreadTotal) })
            } else {
                wx.removeTabBarBadge({ index: 2 })
            }
        } catch (err) {
            console.error('加载会话失败:', err)
            this.setData({ loading: false })
        }
    },

    /**
     * 获取消息预览文本
     */
    getMessagePreview(lastMsg) {
        if (!lastMsg) return ''
        if (lastMsg.type === 'image') return '[图片]'
        return lastMsg.content || ''
    },

    /**
     * 搜索联系人
     */
    onSearchInput(e) {
        const keyword = e.detail.value
        this.setData({
            searchKeyword: keyword,
            filteredConversations: this.filterConversations(this.data.conversations, keyword)
        })
    },

    clearSearch() {
        this.setData({
            searchKeyword: '',
            filteredConversations: this.data.conversations
        })
    },

    filterConversations(list, keyword) {
        if (!keyword) return list
        const kw = keyword.toLowerCase()
        return list.filter(c => (c.nickName || '').toLowerCase().includes(kw))
    },

    /**
     * 左滑删除 - 触摸事件
     */
    onTouchStart(e) {
        const touch = e.touches[0]
        this._touchStartX = touch.clientX
        this._touchStartY = touch.clientY
        this._touchMoved = false

        // 先关闭其他已打开的滑动
        const idx = e.currentTarget.dataset.index
        this.resetAllSlides(idx)
    },

    onTouchMove(e) {
        const touch = e.touches[0]
        const deltaX = touch.clientX - this._touchStartX
        const deltaY = touch.clientY - this._touchStartY

        // 判断是否为水平滑动
        if (Math.abs(deltaX) < Math.abs(deltaY)) return

        this._touchMoved = true
        const idx = e.currentTarget.dataset.index
        const conversations = this.data.filteredConversations

        // 限制滑动范围 [-160, 0]
        let slideX = Math.max(-160, Math.min(0, deltaX * 2))

        // 相对rpx
        conversations[idx].slideX = slideX
        this.setData({ filteredConversations: conversations })
    },

    onTouchEnd(e) {
        if (!this._touchMoved) return

        const idx = e.currentTarget.dataset.index
        const conversations = this.data.filteredConversations
        const currentX = conversations[idx].slideX || 0

        // 超过一半时展开，否则收回
        conversations[idx].slideX = currentX < -80 ? -160 : 0
        this._currentSlideIndex = currentX < -80 ? idx : -1

        this.setData({ filteredConversations: conversations })
    },

    resetAllSlides(exceptIndex) {
        const conversations = this.data.filteredConversations
        let changed = false
        conversations.forEach((conv, i) => {
            if (i !== exceptIndex && conv.slideX !== 0) {
                conv.slideX = 0
                changed = true
            }
        })
        if (changed) {
            this.setData({ filteredConversations: conversations })
        }
    },

    /**
     * 删除会话（本地删除，不删除消息记录）
     */
    deleteConversation(e) {
        const { index } = e.currentTarget.dataset
        const conversations = this.data.filteredConversations
        const removed = conversations.splice(index, 1)

        // 同时从原始列表中移除
        const allConvs = this.data.conversations.filter(c => c.userId !== removed[0].userId)

        this.setData({
            conversations: allConvs,
            filteredConversations: conversations
        })

        wx.showToast({ title: '已删除', icon: 'success' })
    },

    goChat(e) {
        const { userId, nickName } = e.currentTarget.dataset
        // 重置滑动状态
        this.resetAllSlides()
        wx.navigateTo({
            url: `/pages/chat/chat?userId=${userId}&nickName=${encodeURIComponent(nickName || '用户')}`
        })
    }
})
