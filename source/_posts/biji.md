---
title: 笔记
date: 2021-11-20 17:24:27
tags:
  - "笔记"
  - "Python"
  - "pygame"
  - "英语单词"
categories:
  - "学业记录"
keywords:
  - "笔记"
  - "Python"
  - "pygame"
  - "英语"
  - "单词"
description: "英语单词与Python pygame游戏开发的笔记。"
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

> 发布于：2021-11-20 17:24:27
> 别名：`415`

country国家

China中国

capital首都

pattern图案

country国家

China中国

capital首都

pattern图案

country国家

China中国

capital首都

pattern图案
[code] 
    import pygame,random  
    pygame.init()  
    enemy1 = pygame.image.load("images/enemy1.png")  
    enemy2 = pygame.image.load("images/enemy2.png")  
    enemy3 = pygame.image.load("images/enemy3.png")  
      
      
    class Enemy():  
        def __init__(self,x,y,width,height,type,life,score,img):  
            self.width=width  
            self.height=height  
            self.x=random.random(0,480-self.width)  
            self.y=y  
            self.type=type  
            self.life=life  
            self.score=score  
            self.img=img
[/code]

---

> 暂无评论