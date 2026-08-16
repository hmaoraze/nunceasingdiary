---
title: 笔记
date: 2022-08-06 15:14:23
tags:
  - "Python"
  - "pygame"
  - "tkinter"
  - "游戏开发"
categories:
  - "技术笔记"
keywords:
  - "Python"
  - "pygame"
  - "tkinter"
  - "寻找嫌疑人"
description: "使用 pygame 和 tkinter 开发寻找嫌疑人小游戏，涵盖事件处理与界面布局。"
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

> 发布于：2022-08-06 15:14:23
> 别名：`1-2`

## 第一部分

path路径  
event事件  
button按钮
[code] 
    import pygame
    from sys import exit
    import os
    def canvasInit():
        #pygame初始化
        pygame.init()
        global canvas
        canvas = pygame.display.set_mode((1050, 660), 0, 32)
        pygame.display.set_caption('寻找嫌疑人')
        
    #主界面（一级界面）
    while True:
        canvasInit()
        #请在下方书写你的代码
        path="images/bg.jpg"
        bg=pygame.image.load(path)
        canvas.blit(bg,(0,0))
        pygame.display.update()
        
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                exit()
            #请在下方书写你的代码
            if event.type==pygame.MOUSEBUTTONDOWN:
                    if event.button==1:
                        print('左键按下')
                        pos=pygame.mouse.get_pos()
                        mouseX=pos[0]
                        mouseY=pos[1]
                        if 860<=mouseX<=1035 and 480<=mouseY<=650:
                            pygame.quit()
                            exit()
                #请在下方书写你的代码
        
        
        pygame.display.update()
[/code]

## 第二部分

resizable调整大小

window窗口

Label标签

pack打包
[code] 
    from PIL import ImageTk
    import tkinter as tk
    letter = 'The beauty has been sleep\nOne moon lies in the sky\nNonody konws where i am\nI really want to fly\nGo to the secret garden\nHide in zhe bush\nTo  lie on the lawn\n\nAll stars hug the nature\nMy heart will be peace\nOne for all\n                ——My lord'
    #请在下方书写你的代码
    window=tk.Tk()
    window.resizable(0,0)
    window.title('嫌疑人信件')
    bg=ImageTk.PhotoImage(file="images/bg.png")
    letterLab=tk.Label(window,image=bg,
                                            text=letter,
                                            font=('Arial',29),
                                            foreground='white',
                                            compound='center'
                                            )
    letterLab.pack()
    window.mainloop()
    
    
    
    
    
    
    
    
    
    
[/code]

---

> 暂无评论