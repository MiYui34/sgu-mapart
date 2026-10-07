# SGU 地图画

把图片做成 Minecraft **仅地毯**地图画，在浏览器里预览，并下载适用于 **Minecraft 26.1+** 的 `.litematic`。注册需要管理员发放的邀请码。作品可以上架到地图画市场。

本程序以 [GNU GPL-3.0](LICENSE) 发布。地图画作品的版权归上传者，不随程序许可证转移。

源码仓库：<https://github.com/MiYui34/sgu-mapart>

## 环境

- Node.js 22 或更高
- MySQL 5.7 或更高

## 启动

```bash
cp .env.example .env
npm install
npm run create-admin
npm run dev
```

另开一个终端：

```bash
cd client
npm install
npm run dev
```

前端默认在 <http://localhost:5173>，接口在 <http://localhost:3011>。

首次创建的管理员用户名是 `admin`，密码来自 `.env` 里的 `ADMIN_PASSWORD`（示例为 `admin123`）。用这个账号在「邀请码」页生成注册码。

访客可以做图并下载投影。上架市场需要登录。

## 做图

裁剪网格按 128 格一张地图对齐，最大 8×8 张。调节顺序是亮度、对比度、饱和度、色相、伽马，然后按所选算法量化到 16 种地毯。预览可以在裁剪、地图、原图对比和世界视角之间切换。投影的 `MinecraftDataVersion` 为 4786。
