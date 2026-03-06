// 云函数：completeOrder
// 买家确认收货：订单状态 confirmed → completed，书籍状态 → sold
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
    const { OPENID } = cloud.getWXContext()
    const { orderId, bookId } = event

    if (!orderId || !bookId) {
        return { success: false, error: '参数缺失' }
    }

    try {
        const orderRes = await db.collection('orders').doc(orderId).get()
        const order = orderRes.data
        if (order.buyerId !== OPENID) {
            return { success: false, error: '只有买家才能确认收货' }
        }
        if (order.status !== 'confirmed') {
            return { success: false, error: '订单状态不正确，需卖家先确认卖出' }
        }

        const now = db.serverDate()
        await db.collection('orders').doc(orderId).update({
            data: { status: 'completed', updateTime: now }
        })
        await db.collection('books').doc(bookId).update({
            data: { status: 'sold', updateTime: now }
        })

        return { success: true }
    } catch (err) {
        console.error('completeOrder error:', err)
        return { success: false, error: err.message }
    }
}
