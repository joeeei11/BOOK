// 全局入口文件
App({
  globalData: {
    userInfo: null,
    openid: null,
    isAdmin: false,
    cloudEnvId: '' // 云开发环境ID，onLaunch中自动获取
  },

  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }

    const envId = wx.getStorageSync('cloudEnvId') || 'ap1-8gk9kxnc5bdb9f7a'
    wx.cloud.init({
      env: envId,
      traceUser: true
    })

    // 检查本地缓存的登录状态
    this.checkLogin()

    // 未登录或资料未完善 → 跳转登录页
    if (!this.globalData.openid || !this.globalData.userInfo || !this.globalData.userInfo.nickName) {
      wx.reLaunch({ url: '/pages/login/login' })
    }
  },

  // 设置云环境ID（首次使用时调用）
  setCloudEnv(envId) {
    this.globalData.cloudEnvId = envId
    wx.setStorageSync('cloudEnvId', envId)
    wx.cloud.init({
      env: envId,
      traceUser: true
    })
  },

  // 检查登录状态
  checkLogin() {
    const userInfo = wx.getStorageSync('userInfo')
    const openid = wx.getStorageSync('openid')

    if (userInfo && openid) {
      this.globalData.userInfo = userInfo
      this.globalData.openid = openid
      this.globalData.isAdmin = userInfo.isAdmin || false
    }
  },

  // 全局登录方法
  async login() {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'login',
        success: res => {
          const { openid, userInfo } = res.result
          this.globalData.openid = openid
          this.globalData.userInfo = userInfo
          this.globalData.isAdmin = userInfo ? userInfo.isAdmin : false
          wx.setStorageSync('openid', openid)
          if (userInfo) {
            wx.setStorageSync('userInfo', userInfo)
          }
          resolve(res.result)
        },
        fail: err => {
          console.error('登录失败', err)
          reject(err)
        }
      })
    })
  },

  // 获取当前用户信息
  getCurrentUser() {
    return this.globalData.userInfo
  },

  // 检查用户是否已完善资料（有昵称），未完善则跳转填写页
  ensureProfile() {
    if (!this.globalData.openid) {
      wx.navigateTo({ url: '/pages/login/login' })
      return false
    }
    if (!this.globalData.userInfo || !this.globalData.userInfo.nickName) {
      wx.navigateTo({ url: '/pages/login/login' })
      return false
    }
    return true
  },

  // 退出登录
  logout() {
    this.globalData.userInfo = null
    this.globalData.openid = null
    this.globalData.isAdmin = false
    wx.removeStorageSync('userInfo')
    wx.removeStorageSync('openid')
    wx.reLaunch({ url: '/pages/login/login' })
  }
})
