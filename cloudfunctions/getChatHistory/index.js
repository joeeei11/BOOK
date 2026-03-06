// 云函数：getChatHistory
// 获取当前用户与另一用户之间的双向聊天记录
// 支持分页加载（传入 beforeTime 加载更早消息）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
    const { OPENID } = cloud.getWXContext()
    const { otherUserId, beforeTime, limit: userLimit } = event

    if (!otherUserId) return []

    const pageLimit = Math.min(userLimit || 50, 100)

    try {
        let query = db.collection('messages')
            .where(_.or([
                { senderId: OPENID, receiverId: otherUserId },
                { senderId: otherUserId, receiverId: OPENID }
            ]))

        // 支持分页：加载指定时间之前的消息
        if (beforeTime) {
            query = query.where({
                createTime: _.lt(new Date(beforeTime))
            })
        }

        const res = await query
            .orderBy('createTime', 'asc')
            .limit(pageLimit)
            .get()

        return res.data
    } catch (err) {
        console.error('getChatHistory error:', err)
        return []
    }
}
