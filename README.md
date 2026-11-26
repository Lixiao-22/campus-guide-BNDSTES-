# 北京市十一学校天津实验学校 · 校园导览

手机上打开就能带人逛校园的导览页：19 个开放社区、8 种语言、语音讲解，右下角还有校园 AI 问答「闪闪」。

线上地址：https://<你的用户名>.github.io/<仓库名>/

## 这个仓库是什么

GitHub Pages 只能托管静态文件，所以这里是**构建产物**，不是源码：

- `index.html` + `assets/` —— 页面、样式、脚本
- `content/zh.json` … `content/ar.json` —— 每种语言一份内容，访客只下载自己那一种
- `media/img` `media/audio` `media/video` —— 压缩后的图片、讲解录音、影片
- `config.js` —— 线上配置（是否静态、AI 代理地址）

源码和构建脚本在本地 `校园导览/app`，改完执行：

```bash
cd 校园导览/app
node tools/build-static.js --ai-url https://你的-worker.workers.dev/
cd ../site
git add -A && git commit -m "更新内容" && git push
```

## AI 问答怎么工作

页面是纯静态的，放不了 API Key。右下角的「闪闪」请求一个 Cloudflare Worker，
Key 只存在 Worker 的环境变量里。Worker 代码在本地 `校园导览/worker/chat-proxy.js`。

Worker 的知识库直接从这个仓库的 `content/<lang>.json` 读取，
所以**改了页面文案，AI 的回答自动跟着变**，不用另维护一份资料。

## 本地预览

```bash
cd site
python3 -m http.server 8080
# 打开 http://127.0.0.1:8080
```

本机完整版（含多进程服务器、外网隧道、二维码大屏）仍用 `启动校园导览.bat`。
