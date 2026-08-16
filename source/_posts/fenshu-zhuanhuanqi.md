---
title: "分数转换器"         # 【必需】文章标题
date: 2022-08-07 22:44:45          # 【必需】文章创建日期（取自"发布于"时间）
tags:                              # 【标签】横向关联检索
  - "Python"
  - "开源"
  - "工具"
  - "中考"
categories:                        # 【分类】纵向层级归档
  - "技术笔记"
keywords:                          # 【关键词】SEO 优化
  - "分数转换器"
  - "Python"
  - "开源程序"
  - "中考"
description: "为方便换算中考分数线而编写的Python开源小工具，首次开源程序。"
thumbnail: https://image.hsmao.cn/BEIMIAN/2026horseyear.jpg!/format/webp
top_img: https://image.hsmao.cn/BEIMIAN/2026horseyear.jpg!/format/webp
#sticky: 500                        # 适当置顶
aside: true                        # 保留侧边栏
toc: true                          # 保留文章目录
toc_number: true                   # 目录显示层级编号
comments: true                     # 开启评论区
copyright: true                    # 保留版权声明
mathjax: false                     # 不需要数学公式
katex: false                       # 不需要 KaTeX
aplayer: false                     # 不需要音乐播放器
highlight_shrink: false            # 代码块默认不折叠
---

# 分数转换器

> 发布于：2022-08-07 22:44:45
> 别名：`分数转换器`

这不快到中考了嘛！我推测一下分数线可是2022年和2023年的满分不一样，直接减100肯定不行，我用计算器算了几次，但是，我感觉对我这种喜欢反复机械操作的人来说，不够友好！

于是就写了这个简短的程序(这是我第一次开源程序)

[](https://github.com/return2017/Fc)
[code] 
    '''
    项目名称：分数转换器
    版权归属:Return2017
    使用MIT许可协议
    邮箱:hamo#return2017.cn(用@替换#)
    如有问题欢迎您联系!
    您的设备需要装有Python3.6或更高版本
    本程序功能尚未完全实现
    '''
    
    #获取您的当地满分和正确率数据
    user_full_score = float(input("请输入您所在的地区满分："))
    user_percentage = float(input("请输入正确率(不带'%')："))
    #分数计算器核心算法，满分*正确率=分数线上的分
    user_fraction_calculator_algorithm = user_full_score * (user_percentage)
    print("当前总分约为：" + str(user_fraction_calculator_algorithm))
[/code]

由上可以看出目前算法不完善（说白了就是不会Python的百分数运算）欢迎来指正

---

> 暂无评论