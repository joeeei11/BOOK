// 云函数：confirmOrder
// 卖家确认卖出：订单状态 pending → confirmed
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
    const { OPENID } = cloud.getWXContext()
    const { orderId } = event

    if (!orderId) {
        return { success: false, error: '参数缺失' }
    }

    try {
        const orderRes = await db.collection('orders').doc(orderId).get()
        const order = orderRes.data
        if (order.sellerId !== OPENID) {
            return { success: false, error: '只有卖家才能确认卖出' }
        }
        if (order.status !== 'pending') {
            return { success: false, error: '订单状态不正确' }
        }

        await db.collection('orders').doc(orderId).update({
            data: { status: 'confirmed', updateTime: db.serverDate() }
        })

        return { success: true }
    } catch (err) {
        console.error('confirmOrder error:', err)
        return { success: false, error: err.message }
    }
}
