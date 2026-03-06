// 云函数：updateUserInfo
// 更新当前用户的个人资料（云函数以管理员权限运行，绕过集合权限限制）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) {
        return { success: false, error: '未获取到用户身份' }
    }

    const { nickName, avatarUrl, college, grade, phone } = event

    if (!nickName || !nickName.trim()) {
        return { success: false, error: '昵称不能为空' }
    }

    const updateData = {
        nickName: nickName.trim(),
        avatarUrl: avatarUrl || '',
        college: college || '',
        grade: grade || '',
        phone: phone || '',
        updateTime: db.serverDate()
    }

    try {
        await db.collection('users').doc(OPENID).update({
            data: updateData
        })
        return { success: true, userInfo: { _id: OPENID, ...updateData } }
    } catch (err) {
        console.error('updateUserInfo error:', err)
        return { success: false, error: err.message }
    }
}
