// 云函数：getConversations - 获取用户会话列表（优化版）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
    const { OPENID } = cloud.getWXContext()

    try {
        // 获取该用户相关的所有消息
        const res = await db.collection('messages')
            .where(_.or([
                { senderId: OPENID },
                { receiverId: OPENID }
            ]))
            .orderBy('createTime', 'desc')
            .limit(200)
            .get()

        const messages = res.data

        // 按对方用户ID分组，取每组最新一条
        const convMap = {}
        messages.forEach(msg => {
            const otherUserId = msg.senderId === OPENID ? msg.receiverId : msg.senderId
            if (!convMap[otherUserId]) {
                convMap[otherUserId] = {
                    userId: otherUserId,
                    lastMsg: msg,
                    unread: 0
                }
            }
            if (msg.receiverId === OPENID && !msg.isRead) {
                convMap[otherUserId].unread++
            }
        })

        const conversations = Object.values(convMap)

        // 批量获取用户信息（减少N+1查询）
        const userIds = conversations.map(c => c.userId)
        const userMap = {}

        // 分批获取，每批最多20个
        for (let i = 0; i < userIds.length; i += 20) {
            const batch = userIds.slice(i, i + 20)
            try {
                const usersRes = await db.collection('users')
                    .where({
                        _id: _.in(batch)
                    })
                    .field({ nickName: true, avatarUrl: true })
                    .get()

                usersRes.data.forEach(u => {
                    userMap[u._id] = u
                })
            } catch (e) {
                console.warn('批量获取用户信息失败:', e)
            }
        }

        // 合并用户信息
        conversations.forEach(conv => {
            const user = userMap[conv.userId]
            conv.nickName = user ? (user.nickName || '用户') : '用户'
            conv.avatarUrl = user ? (user.avatarUrl || '') : ''
        })

        // 按最新消息时间排序
        conversations.sort((a, b) => {
            const timeA = a.lastMsg.createTime ? new Date(a.lastMsg.createTime) : 0
            const timeB = b.lastMsg.createTime ? new Date(b.lastMsg.createTime) : 0
            return timeB - timeA
        })

        return conversations
    } catch (err) {
        console.error('getConversations error:', err)
        return []
    }
}
