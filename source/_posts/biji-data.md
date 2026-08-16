---
title: 笔记
date: 2021-10-30 17:25:27
tags:
  - "笔记"
  - "Python"
  - "pygame"
  - "飞机大战"
categories:
  - "学业记录"
keywords:
  - "笔记"
  - "Python"
  - "pygame"
  - "飞机大战"
  - "游戏"
description: "Python pygame飞机大战游戏开发与列表学习的笔记。"
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

> 发布于：2021-10-30 17:25:27
> 别名：`data`

[code]
    #coding:utf-8
    import pygame,sys,random
    from pygame.locals import*
    #初始化pygame环境
    #创建一个长宽分别为480/650窗口
    canvas = pygame.display.set_mode((480, 650))
    canvas.fill((255,255,255))
    
    #设置窗口标题
    pygame.display.set_caption("飞机大战")
    bg=pygame.image.load("images/bg1.png")
    enemy1 = pygame.image.load("images/enemy1.png")
    
    def handleEvent():
        for event in pygame.event.get():
            if event.type==pygame.QUIT or event.type == KEYDOWN and event.key == K_ESCAPE:
                pygame.quit()
                sys.exit()                 
    #定义Sky类
    class Sky():
        def __init__(self):
            self.width = 480
            self.height = 852
            self.img = bg
            self.x1 = 0
            self.y1 = 0
            self.x2 = 0
            self.y2 = -self.height
        #创建paint方法
        def paint(self):
            canvas.blit(self.img,(self.x1,self.y1))
            canvas.blit(self.img,(self.x2,self.y2))
        def step(self):
            self.y1 = self.y1+1
            self.y2=self.y2+1
            if self.y1>self.height:
                self.y1=-self.height
            if self.y2>self.height:
                self.y2=-self.height
        #创建step方法
    class Enemy():
        def __init__(self,x,y,width,height,type,life,score,img):
            self.x=x
            self.y=y
            self.width=width
            self.height=height
            self.type=type
            self.life=life
            self.score=score
            self.img=img
        
        def paint(self):
            canvas.blit(self.img,(self.x,self.y))
        def step(self):
            self.y=self.y+2
            
            
        
    #创建sky对象
    sky = Sky()
    enemy=Enemy(0,-45,57,45,1,1,1,enemy1)
    while True:
        #调用sky对象的paint方法
        sky.paint()
        #调用sky对象的step方法
        sky.step()
        enemy.paint()
        enemy.step()
        
           
        #更新屏幕内容
        pygame.display.update()
        #处理关闭游戏
        handleEvent()
        pygame.time.delay(15)
[/code]

列表

sx=['1','+','1','=','2']  
print(sx)

从0开始
[code] 
    sx=['爸爸','妈妈','我','姐姐','爷爷'，'奶奶']
    print(sx[1])
    
[/code]

---

> 暂无评论