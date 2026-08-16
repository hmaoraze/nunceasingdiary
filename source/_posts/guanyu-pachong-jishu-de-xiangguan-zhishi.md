---
title: "关于爬虫技术的相关知识"         # 【必需】文章标题
date: 2022-12-03 17:22:00          # 【必需】文章创建日期（取自"发布于"时间）
tags:                              # 【标签】横向关联检索
  - "Python"
  - "爬虫"
  - "requests"
  - "BeautifulSoup"
categories:                        # 【分类】纵向层级归档
  - "技术笔记"
keywords:                          # 【关键词】SEO 优化
  - "Python爬虫"
  - "requests"
  - "BeautifulSoup"
  - "网页抓取"
description: "介绍Python爬虫相关知识，涵盖requests库、BeautifulSoup库及抓取豆瓣网页的实例。"
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

# 关于爬虫技术的相关知识

> 发布于：2022-12-03 17:22:00
> 别名：`关于爬虫技术的相关知识`

> _warning_ 注意  
> **此文章仅适用于Python语言，且仅用于学习交流**

# 啥玩应是爬虫？

爬虫，又称为网页蜘蛛或网络机器人，是一种按照一定的规则，自动地抓取网络上信息的程序或者脚本。

被折叠的内容

 _keyboard_arrow_down_

可能带点东北口音，见谅！ :!: 

# requests

![](https://pic.imgdb.cn/item/638b21a116f2c2beb1cbec44.jpg)关于requests的动画解释

**requests** 是Python的一个第三方网络请求库，为避免错误，可以模拟浏览器的行为，进行网络请求，获取网络数据。

# 查看响应数据的三种方法
[code] 
    response.json() 键值对形式
    response.text 字符串数据-获取文本
    response.content 二进制数据-获取图片
[/code]

# 关于BeautifulSoup库

**BeautifulSoup是一个可以从HTML文件中抓取数据的Python库**

![](https://pic.imgdb.cn/item/638b089b16f2c2beb1a1ad4f.jpg)BeautifulSoup库

## BeautifulSoup对象的查找数据的方法

1.find()方法：返回第一个符合条件的内容

2.find all()方法：查找到所有符合条件的内容，返回一个列表

3.select()方法：查找有特定标签、属性的元素，返回一个列表

**一般来说，find all()和find()方法较为普遍，select()方法比较简洁**

**soup. select('标签名.class值'）**

# 例：使用Python获取豆瓣某网页的源代码

> 以下代码可能用到的第三方库名(已使用英文逗号隔开)
> 
> requests,bs4,lxml
[code] 
    '''
    邮箱:hamo#return2017.cn(用@替换#)
    如果有问题我很乐意让您联系!
    您的设备可能需要装有Python3.6或更高版本
    '''
    
    #导入requests库和bs4库等(非Python自带)
    import requests
    from bs4 import BeautifulSoup
    
    #HTTP请求头(以系统Windows10，Edge浏览器为例)
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.56'}
    
    #把豆瓣相关网址赋值到url
    url='https://music.douban.com/tag/民谣'
    
    #使用requests模块获取网页源代码
    response=requests.get(url,headers=headers)
    
    #使用print函数显示豆瓣网页的源代码
    print(response.text)
    
    #创建BeautifulSoup对象，使用'lxml'解析方法
    soup=BeautifulSoup(response.text,'lxml')
    listResult=soup.select('tr.item')
    
    #使用print函数显示含有'tr'标签的名为'item'的class的值
    print(listResult)
    
    #定义音乐名列表
    musicNames=[]
    
    #遍历listResult列表，使用for in 循环，获取所有'a'标签里含有'title'的值
    for result in listResult:
        musicNames.append(result.select('a')[0]['title'])
    
    #完成上述内容，并以列表的形式显示出爬虫获取到的内容
    print(musicNames)
[/code]

# 结尾

最后，送你一个练习题，可以试试看。
[code] 
    import requests
    
    headers1 = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.56'}
    
    
    #题目：使用requests发送get请求,获取url为' http://www.baidu.com '的数据，
    #并将响应数据的文本内容打印在控制台上哦
    
[/code]

* * *

**对了，如果有错误的地方，欢迎各位大佬指正**

---

## 💬 评论

### linkkk  ·  2022-12-05 20:29

> Python爬虫玩得好，方便一生；玩不好，牢饭吃饱 :oops:

### hmao  ·  2022-12-05 21:54

> 改了一下，仅用于学习交流 :!:

### hmao博客  ·  2023-01-05 07:30

> text

### hmao博客  ·  2023-01-05 07:31

> 軻
