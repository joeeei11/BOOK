// utils/api.js - 云函数调用统一封装

/**
 * 调用云函数的通用方法
 */
const callCloud = (name, data = {}) => {
    return new Promise((resolve, reject) => {
        wx.cloud.callFunction({
            name,
            data,
            success: res => resolve(res.result),
            fail: err => {
                console.error(`云函数 ${name} 调用失败:`, err)
                reject(err)
            }
        })
    })
}

// 数据库引用（延迟获取，避免初始化时机问题）
const getDb = () => wx.cloud.database()
const getCmd = () => wx.cloud.database().command

// ===== 用户相关 =====
const userAPI = {
    // 登录
    login: () => callCloud('login'),

    // 获取任意用户公开信息（云函数，绕过"仅创建者可读"权限）
    getUserInfo: (userId) => callCloud('getUserPublicInfo', { userId }),

    // 更新自己的用户信息（自己的文档，有写权限）
    updateUserInfo: (data) => {
        const app = getApp()
        return wx.cloud.database().collection('users').doc(app.globalData.openid).update({ data })
            .then(() => {
                app.globalData.userInfo = { ...app.globalData.userInfo, ...data }
                wx.setStorageSync('userInfo', app.globalData.userInfo)
            })
    }
}

// ===== 书籍相关 =====
const bookAPI = {
    // 获取书籍列表（云函数，绕过权限，支持全部用户浏览）
    getBooks: (params = {}) => callCloud('getBooks', params),

    // 关键词搜索书籍（同上，云函数支持模糊搜索）
    searchBooks: (params) => callCloud('getBooks', params),

    // 获取书籍详情（云函数，绕过"仅创建者可读"权限；同时在云函数中累加浏览量）
    getBookDetail: (bookId) => callCloud('getBooks', { bookId }),

    // 发布书籍（自己写自己的文档，有权限）
    publishBook: (data) => {
        const app = getApp()
        const db = wx.cloud.database()
        return db.collection('books').add({
            data: {
                ...data,
                sellerId: app.globalData.openid,
                status: 'on_sale',
                viewCount: 0,
                createTime: db.serverDate(),
                updateTime: db.serverDate()
            }
        }).then(res => res._id)
    },

    // 更新自己发布的书籍（自己的文档，有权限）
    updateBook: (bookId, data) => {
        const db = wx.cloud.database()
        return db.collection('books').doc(bookId).update({
            data: { ...data, updateTime: db.serverDate() }
        })
    },

    // 下架自己的书籍
    withdrawBook: (bookId) => {
        const db = wx.cloud.database()
        return db.collection('books').doc(bookId).update({
            data: { status: 'withdrawn', updateTime: db.serverDate() }
        })
    },

    // 获取我发布的书籍（自己的文档，有权限）
    getMyBooks: () => {
        const app = getApp()
        return wx.cloud.database().collection('books')
            .where({ sellerId: app.globalData.openid })
            .orderBy('createTime', 'desc')
            .get()
            .then(res => res.data)
    },

    // 获取指定卖家的在售书籍（云函数，绕过权限）
    getBooksBySeller: (sellerId) => callCloud('getBooks', { sellerId }),

    // 增加浏览量（已集成到 getBookDetail 云函数中，此处保留为空操作）
    incrementView: () => Promise.resolve()
}

// ===== 订单相关 =====
const orderAPI = {
    // 创建订单
    createOrder: (params) => callCloud('createOrder', params),

    // 获取用户作为买家的订单
    getBuyerOrders: () => {
        const app = getApp()
        return wx.cloud.database().collection('orders')
            .where({ buyerId: app.globalData.openid })
            .orderBy('createTime', 'desc')
            .get()
            .then(res => res.data)
    },

    // 获取用户作为卖家的订单（云函数，绕过"仅创建者可读"权限，订单由买家创建）
    getSellerOrders: () => callCloud('getSellerOrders'),

    // 更新订单状态
    updateOrderStatus: (orderId, status) => {
        return wx.cloud.database().collection('orders').doc(orderId).update({
            data: { status, updateTime: wx.cloud.database().serverDate() }
        })
    },

    // 取消订单（云函数方式，同时恢复书籍状态为在售）
    cancelOrder: (orderId) => callCloud('cancelOrder', { orderId }),

    // 确认交易完成（云函数，同时将订单标记为完成、书籍标记为已售）
    completeOrder: (orderId, bookId) => callCloud('completeOrder', { orderId, bookId })
}

// ===== 消息相关 =====
const messageAPI = {
    // 发送消息（支持 type: 'text' | 'image'）
    sendMessage: (receiverId, content, bookId = '', type = 'text') => {
        const app = getApp()
        return wx.cloud.database().collection('messages').add({
            data: {
                senderId: app.globalData.openid,
                receiverId,
                content,
                type,
                bookId,
                isRead: false,
                createTime: wx.cloud.database().serverDate()
            }
        })
    },

    // 发送图片消息（先上传图片再创建消息）
    sendImageMessage: async (receiverId, filePath, bookId = '') => {
        const ext = filePath.split('.').pop()
        const cloudPath = `chat/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const uploadRes = await wx.cloud.uploadFile({ cloudPath, filePath })
        return messageAPI.sendMessage(receiverId, uploadRes.fileID, bookId, 'image')
    },

    // 获取与某用户的聊天记录（云函数，需双向查询，客户端只能查自己发送的消息）
    getChatHistory: (otherUserId, beforeTime) => callCloud('getChatHistory', { otherUserId, beforeTime }),

    // 标记消息为已读（云函数，消息属于发送者，接收者无权直接修改）
    markAsRead: (otherUserId) => callCloud('markMessagesRead', { senderId: otherUserId }),

    // 获取会话列表（最新一条消息）
    getConversations: () => callCloud('getConversations'),

    // 获取未读消息数
    getUnreadCount: () => {
        const app = getApp()
        return wx.cloud.database().collection('messages')
            .where({ receiverId: app.globalData.openid, isRead: false })
            .count()
            .then(res => res.total)
    }
}

// ===== 评价相关 =====
const reviewAPI = {
    // 提交评价
    submitReview: async ({ orderId, revieweeId, score, content }) => {
        const app = getApp()
        const db = wx.cloud.database()
        // 创建评价记录
        await db.collection('reviews').add({
            data: {
                orderId,
                reviewerId: app.globalData.openid,
                revieweeId,
                score,
                content,
                createTime: db.serverDate()
            }
        })
        // 更新信用分
        return callCloud('updateCreditScore', { revieweeId, score })
    },

    // 获取用户收到的评价
    getUserReviews: (userId) => {
        return wx.cloud.database().collection('reviews')
            .where({ revieweeId: userId })
            .orderBy('createTime', 'desc')
            .get()
            .then(res => res.data)
    },

    // 检查订单是否已评价
    hasReviewed: (orderId) => {
        const app = getApp()
        return wx.cloud.database().collection('reviews')
            .where({ orderId, reviewerId: app.globalData.openid })
            .count()
            .then(res => res.total > 0)
    }
}

// ===== 图片上传 =====
const uploadImage = async (filePath) => {
    const ext = filePath.split('.').pop()
    const cloudPath = `books/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const res = await wx.cloud.uploadFile({ cloudPath, filePath })
    return res.fileID
}

// ===== 图片临时链接转换 =====
const getTempFileURL = (fileID) => {
    return new Promise((resolve, reject) => {
        wx.cloud.getTempFileURL({
            fileList: [fileID],
            success: res => resolve(res.fileList[0].tempFileURL),
            fail: reject
        })
    })
}

module.exports = {
    callCloud,
    userAPI,
    bookAPI,
    orderAPI,
    messageAPI,
    reviewAPI,
    uploadImage,
    getTempFileURL
}
