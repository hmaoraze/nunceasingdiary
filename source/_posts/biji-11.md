---
title: 笔记
date: 2021-10-16 17:55:04
tags:
  - "Python"
  - "easygui"
  - "登录注册"
categories:
  - "技术笔记"
keywords:
  - "Python"
  - "easygui"
  - "登录"
  - "注册"
description: "使用 Python easygui 库实现简单的用户登录注册功能。"
thumbnail: https://image.hsmao.cn/BEIMIAN/2026horseyear.jpg!/format/webp
top_img: https://image.hsmao.cn/BEIMIAN/2026horseyear.jpg!/format/webp
aside: true
toc: true
toc_number: true
comments: true
copyright: true
mathjax: false
katex: false
aplayer: false
highlight_shrink: false
---

# 笔记

> 发布于：2021-10-16 17:55:04
> 别名：`11`

[code]
    #coding:utf-8
    '''
    login 登录login,login
    register注册register,register
    '''
    import easygui
    class User():
        def __init__(self,name,pwd):
            self.name=name
            self.pwd=pwd
        def regsiter(self):
            easygui.msgbox('用户名是：'+self.name+'\n'+'密码是：'+self.pwd)
    name=easygui.enterbox('请输入用户名')
    pwd=easygui.enterbox('输入密码')
    user=User(name,pwd)
    user.regsiter()
    while True:
        myname=easygui.enterbox('输入登陆账号')
        if myname==name:
            mypwd=easygui.enterbox('登录密码')
            if mypwd==pwd:
                easygui.msgbox('登录成功')
                break;
            else:
                easygui.msgbox('密码错误')
        else:
            easygui.msgbox('账号错误')
    
    myname=easygui.enterbox('请输入')
    
[/code]

---

> 暂无评论