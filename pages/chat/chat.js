// pages/chat/chat.js - 微信风格聊天页面（优化版）
const { messageAPI, bookAPI, userAPI } = require('../../utils/api')
const { formatChatTime, shouldShowTimeGroup } = require('../../utils/format')

Page({
    data: {
        otherUserId: '',
        bookId: '',
        bookInfo: null,
        messages: [],
        myId: '',
        myInfo: null,
        otherUser: {},
        inputMsg: '',
        scrollToId: 'msg-bottom',
        showMore: false,
        loading: true,
        loadingMore: false,
        _lastMsgId: '',
        statusBarHeight: 20,
        keyboardHeight: 0
    },

    async onLoad(options) {
        const { userId, bookId, bookTitle, nickName } = options
        const app = getApp()

        // 获取状态栏高度
        const sysInfo = wx.getSystemInfoSync()
        this.setData({ statusBarHeight: sysInfo.statusBarHeight || 20 })

        if (!app.globalData.openid) {
            wx.showToast({ title: '请先登录', icon: 'none' })
            wx.navigateBack()
            return
        }

        // 先设置临时显示名称
        this.setData({
            otherUserId: userId,
            bookId: bookId || '',
            myId: app.globalData.openid,
            otherUser: { nickName: nickName || bookTitle || '加载中...' }
        })

        // 并行加载：对方信息、我的信息、聊天记录、书籍信息
        try {
            const [otherUser, myInfo] = await Promise.all([
                userAPI.getUserInfo(userId),
                userAPI.getUserInfo(app.globalData.openid),
                this.loadMessages(),
                bookId ? this.loadBookInfo(bookId) : Promise.resolve()
            ])

            // 确保 nickName 不为空，依次取：云函数返回 → URL参数 → 默认值
            const resolvedName = (otherUser && otherUser.nickName) || nickName || '用户'
            this.setData({
                otherUser: { ...(otherUser || {}), nickName: resolvedName },
                myInfo: myInfo || {},
                loading: false
            })
        } catch (err) {
            console.error('加载聊天数据失败:', err)
            this.setData({ loading: false })
        }

        // 标记消息已读
        messageAPI.markAsRead(userId).catch(() => { })

        // 开始轮询
        this.startPolling()
    },

    onUnload() {
        this.stopPolling()
    },

    goBack() {
        wx.navigateBack({ delta: 1 })
    },

    goUserProfile() {
        if (this.data.otherUserId) {
            wx.navigateTo({ url: `/pages/profile/profile?userId=${this.data.otherUserId}` })
        }
    },

    startPolling() {
        this._pollingTimer = setInterval(() => {
            this.loadMessages()
        }, 3000)
    },

    stopPolling() {
        if (this._pollingTimer) {
            clearInterval(this._pollingTimer)
            this._pollingTimer = null
        }
    },

    async loadMessages() {
        try {
            const rawMessages = await messageAPI.getChatHistory(this.data.otherUserId)
            const lastId = rawMessages.length > 0 ? rawMessages[rawMessages.length - 1]._id : ''
            if (lastId === this.data._lastMsgId && rawMessages.length === this.data.messages.length) return

            const messages = this.processMessages(rawMessages)
            this.setData({
                messages,
                scrollToId: 'msg-bottom',
                _lastMsgId: lastId
            })

            messageAPI.markAsRead(this.data.otherUserId).catch(() => { })
        } catch (err) {
            console.error('加载消息失败:', err)
        }
    },

    processMessages(rawMessages) {
        return rawMessages.map((msg, idx) => {
            const prevMsg = idx > 0 ? rawMessages[idx - 1] : null
            const showTime = shouldShowTimeGroup(
                prevMsg ? prevMsg.createTime : null,
                msg.createTime
            )
            return {
                ...msg,
                showTime,
                timeStr: showTime ? formatChatTime(msg.createTime) : '',
                type: msg.type || 'text'
            }
        })
    },

    async loadBookInfo(bookId) {
        try {
            const bookInfo = await bookAPI.getBookDetail(bookId)
            this.setData({ bookInfo })
        } catch (e) {
            console.warn('加载书籍信息失败:', e)
        }
    },

    onMsgInput(e) {
        this.setData({ inputMsg: e.detail.value })
    },

    onInputFocus(e) {
        this.setData({
            showMore: false,
            keyboardHeight: e.detail.height || 0,
            scrollToId: ''
        })
        setTimeout(() => {
            this.setData({ scrollToId: 'msg-bottom' })
        }, 300)
    },

    onInputBlur() {
        this.setData({ keyboardHeight: 0 })
    },

    async sendMessage() {
        const content = this.data.inputMsg.trim()
        if (!content) return

        const tempMsg = {
            _id: 'temp_' + Date.now(),
            senderId: this.data.myId,
            receiverId: this.data.otherUserId,
            content,
            type: 'text',
            createTime: new Date(),
            sending: true,
            showTime: false,
            timeStr: ''
        }

        const lastMsg = this.data.messages.length > 0 ? this.data.messages[this.data.messages.length - 1] : null
        if (shouldShowTimeGroup(lastMsg ? lastMsg.createTime : null, tempMsg.createTime)) {
            tempMsg.showTime = true
            tempMsg.timeStr = formatChatTime(tempMsg.createTime)
        }

        this.setData({
            inputMsg: '',
            messages: [...this.data.messages, tempMsg],
            scrollToId: 'msg-bottom',
            showMore: false
        })

        try {
            await messageAPI.sendMessage(this.data.otherUserId, content, this.data.bookId)
            await this.loadMessages()
        } catch (e) {
            wx.showToast({ title: '发送失败', icon: 'error' })
            this.setData({
                inputMsg: content,
                messages: this.data.messages.filter(m => m._id !== tempMsg._id)
            })
        }
    },

    async chooseImage() {
        this.setData({ showMore: false })
        try {
            const res = await wx.chooseMedia({
                count: 1,
                mediaType: ['image'],
                sourceType: ['album'],
                sizeType: ['compressed']
            })
            await this._sendImageFile(res.tempFiles[0].tempFilePath)
        } catch (e) {
            if (e.errMsg && e.errMsg.includes('cancel')) return
            console.error('选择图片失败:', e)
            wx.showToast({ title: '操作失败', icon: 'error' })
        }
    },

    async takePhoto() {
        this.setData({ showMore: false })
        try {
            const res = await wx.chooseMedia({
                count: 1,
                mediaType: ['image'],
                sourceType: ['camera'],
                sizeType: ['compressed']
            })
            await this._sendImageFile(res.tempFiles[0].tempFilePath)
        } catch (e) {
            if (e.errMsg && e.errMsg.includes('cancel')) return
            console.error('拍照失败:', e)
            wx.showToast({ title: '操作失败', icon: 'error' })
        }
    },

    async _sendImageFile(filePath) {
        const tempMsg = {
            _id: 'temp_img_' + Date.now(),
            senderId: this.data.myId,
            receiverId: this.data.otherUserId,
            content: filePath,
            type: 'image',
            createTime: new Date(),
            sending: true,
            showTime: false,
            timeStr: ''
        }

        const lastMsg = this.data.messages.length > 0 ? this.data.messages[this.data.messages.length - 1] : null
        if (shouldShowTimeGroup(lastMsg ? lastMsg.createTime : null, tempMsg.createTime)) {
            tempMsg.showTime = true
            tempMsg.timeStr = formatChatTime(tempMsg.createTime)
        }

        this.setData({
            messages: [...this.data.messages, tempMsg],
            scrollToId: 'msg-bottom'
        })

        try {
            await messageAPI.sendImageMessage(this.data.otherUserId, filePath, this.data.bookId)
            await this.loadMessages()
        } catch (err) {
            console.error('发送图片失败:', err)
            wx.showToast({ title: '图片发送失败', icon: 'error' })
        }
    },

    previewChatImage(e) {
        const src = e.currentTarget.dataset.src
        const urls = this.data.messages
            .filter(m => m.type === 'image')
            .map(m => m.content)
        wx.previewImage({
            current: src,
            urls: urls.length > 0 ? urls : [src]
        })
    },

    showMoreActions() {
        this.setData({ showMore: !this.data.showMore })
        if (this.data.showMore) {
            setTimeout(() => {
                this.setData({ scrollToId: 'msg-bottom' })
            }, 300)
        }
    },

    onVoiceTap() {
        wx.showToast({ title: '语音功能开发中', icon: 'none' })
    },

    onEmojiTap() {
        wx.showToast({ title: '表情功能开发中', icon: 'none' })
    },

    createOrderFromChat() {
        this.setData({ showMore: false })
        if (this.data.bookId) {
            wx.navigateTo({ url: `/pages/book-detail/book-detail?id=${this.data.bookId}` })
        }
    },

    goBookDetail() {
        if (this.data.bookId) {
            wx.navigateTo({ url: `/pages/book-detail/book-detail?id=${this.data.bookId}` })
        }
    }
})
