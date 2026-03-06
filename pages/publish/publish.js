// pages/publish/publish.js - 发布/编辑书籍
const { bookAPI, uploadImage } = require('../../utils/api')
const { COLLEGES, GRADES } = require('../../utils/format')

const CONDITIONS = [
    { label: '全新', value: 'new' },
    { label: '九成新', value: '9' },
    { label: '八成新', value: '8' },
    { label: '七成及以下', value: '7' }
]

Page({
    data: {
        isEdit: false,
        bookId: '',
        imageList: [],
        form: {
            title: '',
            author: '',
            isbn: '',
            price: '',
            condition: '9',
            college: '',
            grade: '',
            description: ''
        },
        colleges: COLLEGES,
        grades: GRADES,
        conditions: CONDITIONS,
        submitting: false
    },

    onShow() {
        if (!getApp().ensureProfile()) return
    },

    async onLoad(options) {
        const { id } = options
        if (id) {
            // 编辑模式
            this.setData({ isEdit: true, bookId: id })
            wx.setNavigationBarTitle({ title: '编辑书籍' })
            await this.loadBookData(id)
        }
    },

    async loadBookData(id) {
        const book = await bookAPI.getBookDetail(id)
        if (book) {
            this.setData({
                form: {
                    title: book.title || '',
                    author: book.author || '',
                    isbn: book.isbn || '',
                    price: String(book.price || ''),
                    condition: book.condition || '9',
                    college: book.college || '',
                    grade: book.grade || '',
                    description: book.description || ''
                },
                imageList: book.images || []
            })
        }
    },

    // 选择图片
    async chooseImage() {
        const remaining = 9 - this.data.imageList.length
        try {
            const res = await wx.chooseMedia({
                count: remaining,
                mediaType: ['image'],
                sizeType: ['compressed'],
                sourceType: ['album', 'camera']
            })
            const tempPaths = res.tempFiles.map(f => f.tempFilePath)
            this.setData({ imageList: [...this.data.imageList, ...tempPaths] })
        } catch (e) { /* 用户取消 */ }
    },

    // 删除图片
    removeImage(e) {
        const index = e.currentTarget.dataset.index
        const newList = [...this.data.imageList]
        newList.splice(index, 1)
        this.setData({ imageList: newList })
    },

    // 表单输入
    onInput(e) {
        const field = e.currentTarget.dataset.field
        this.setData({ [`form.${field}`]: e.detail.value })
    },

    // 选择成色
    selectCondition(e) {
        this.setData({ 'form.condition': e.currentTarget.dataset.value })
    },

    // 选择学院
    selectCollege(e) {
        this.setData({ 'form.college': COLLEGES[e.detail.value] })
    },

    // 选择年级
    selectGrade(e) {
        this.setData({ 'form.grade': GRADES[e.detail.value] })
    },

    // 表单校验
    validate() {
        const { form, imageList } = this.data
        if (!form.title.trim()) { wx.showToast({ title: '请输入书名', icon: 'none' }); return false }
        if (!form.price || isNaN(parseFloat(form.price)) || parseFloat(form.price) <= 0) {
            wx.showToast({ title: '请输入有效价格', icon: 'none' }); return false
        }
        if (imageList.length === 0) { wx.showToast({ title: '请至少上传一张图片', icon: 'none' }); return false }
        return true
    },

    // 提交表单
    async submitForm() {
        if (!this.validate()) return
        this.setData({ submitting: true })
        wx.showLoading({ title: '发布中...' })

        try {
            // 上传未上传的图片（临时路径）
            const uploadedImages = []
            for (const path of this.data.imageList) {
                if (path.startsWith('cloud://') || path.startsWith('https://')) {
                    uploadedImages.push(path) // 已上传的图片
                } else {
                    const fileID = await uploadImage(path)
                    uploadedImages.push(fileID)
                }
            }

            const bookData = {
                ...this.data.form,
                price: parseFloat(this.data.form.price),
                images: uploadedImages,
                coverImage: uploadedImages[0] || ''
            }

            if (this.data.isEdit) {
                await bookAPI.updateBook(this.data.bookId, bookData)
                wx.showToast({ title: '修改成功' })
            } else {
                await bookAPI.publishBook(bookData)
                wx.showToast({ title: '发布成功！' })
            }

            setTimeout(() => {
                wx.navigateBack()
            }, 1500)
        } catch (err) {
            console.error('发布失败:', err)
            wx.showToast({ title: '发布失败，请重试', icon: 'error' })
        } finally {
            wx.hideLoading()
            this.setData({ submitting: false })
        }
    }
})
