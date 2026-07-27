# 考研学习中心 · GitHub Pages 部署指南

> 这是一个可以挂在 GitHub Pages 上的网址版考研学习中心，电脑和手机打开同一链接即可学习，数据通过你的 private Gist 跨设备同步。

---

## 一、你需要准备什么

1. 一个 **GitHub 账号**（已有）。
2. 一个 **GitHub Personal Access Token**（下面会教你怎么生成）。
3. 这个文件夹里的全部文件（`site/` 中的内容）。

---

## 二、部署步骤（共 5 步）

### 1. 在 GitHub 上新建仓库

- 打开 https://github.com/new
- Repository name 填：`kaoyan-learning-center`（随便取）。
- 选择 **Public**（Private 仓库 GitHub Pages 也能用，但 Pages 功能要手动开启）。
- 不要勾选 README / .gitignore / license，直接点 **Create repository**。

### 2. 把本文件夹内容上传到这个仓库

最简单的办法：在 GitHub 网页里点 **uploading an existing file**，然后把 `site/` 里的所有文件（包括子目录）拖进去，提交。

> 注意：是上传 `site/` **里面的内容**，不是上传 `site` 这个文件夹本身。也就是说仓库根目录下要有 `index.html`。

如果你想用命令行：

```bash
cd site
git init
git add .
git commit -m "init"
git remote add origin https://github.com/你的用户名/kaoyan-learning-center.git
git push -u origin main
```

### 3. 开启 GitHub Pages

- 进入仓库 → **Settings** → 左侧 **Pages**。
- Source 选择 **Deploy from a branch**。
- Branch 选择 **main / (root)**，点 **Save**。
- 等 1-2 分钟，会出现访问链接：`https://你的用户名.github.io/kaoyan-learning-center`。

### 4. 生成 GitHub Token（用于同步数据）

- 打开 https://github.com/settings/tokens
- 点 **Generate new token (classic)**。
- Token name 填：`kaoyan-sync`。
- **Expiration** 选 `No expiration`（或者选久一点）。
- 勾选 **`gist`** 这个权限（只需要 gist，别的都不要勾）。
- 点 **Generate token**，复制生成的字符串（只显示一次，务必保存好）。

### 5. 在网页里输入 Token 并上传一次

- 电脑浏览器打开 `https://你的用户名.github.io/kaoyan-learning-center`。
- 点击右下角 **☁️ 同步** 按钮，粘贴 GitHub Token，点 **上传**。
- 成功后，手机或其他浏览器打开同一网址，同样点 ☁️ → **下载**，数据就同步过来了。

> Token 只保存在当前浏览器 localStorage 里，不会上传到服务器。数据真正存于你私人的 Gist，只有知道 Token 的人才能读写。

---

## 三、各功能在网址版上的变化

| 功能 | 本地版 | 网址版 |
|---|---|---|
| 词库导入 | 连接本地文件夹 `词汇总表.md` | 点「连接词库」自动从站点内 `考研英语/单词追踪/词汇总表.md` 加载 |
| 单词复习 / 查词记录 | 浏览器 localStorage | 同上 + 可同步到 Gist |
| 数学自动出题 / 加入题库 | 浏览器 localStorage | 同上 + 可同步到 Gist |
| 学习日报 | 读取 `学习日报数据/YYYY-MM-DD.json` | 优先读取 Gist 缓存，再回退到站点内 JSON |
| 翻译代理 / OCR | 依赖本机 `translate-proxy` | 手机上访问不到本机代理，网页翻译/OCR 功能不可用，但 Gist 同步可用 |

---

## 四、日常使用建议

- **电脑端**：正常使用，学习结束后点右下角 ☁️ → **上传**。
- **手机端**：打开同一网址，点 ☁️ → **下载**，即可看到和电脑完全一致的学习记录、日报、错题。
- **日报更新**：每天在 WorkBuddy 里对 AI 说 `生成 2026-07-25 学习日报`，AI 会把数据写入 Gist，手机和电脑刷新即可看到。

---

## 五、常见问题

**Q：同步按钮显示「GitHub 401 / 403」？**
A：Token 填错了，或者 Token 没勾选 `gist` 权限。重新生成一个。

**Q：上传了但手机下载后没数据？**
A：先确认电脑端上传成功，手机端输入的是同一个 Token，然后刷新页面。

**Q：我想把数据清空重来？**
A：在浏览器设置里清除 `你的用户名.github.io` 的 localStorage，然后重新下载 Gist 数据。

**Q：GitHub Pages 网址在国内打开慢？**
A：可以换 DNS 或加 CDN 加速，但这里不展开。如果主要在国内使用，也可以考虑把仓库部署到 Gitee Pages（需要 Gitee 账号）。
