# 登录与身份系统接入指南

当前首版按内部可信用户运行。公司接入登录系统时，建议新增认证 Port 和内部 Adapter，而不是把 SSO 逻辑写入每个 Route。

## 建议契约

```ts
type Identity = {
  userId: string;
  displayName: string;
  roles: string[];
  groups: string[];
};

interface AuthProvider {
  authenticate(request: Request): Promise<Identity | null>;
}
```

应用层只消费标准 Identity。LDAP、OIDC、SAML、公司网关 Header 或 Cookie 验签均由内部 Adapter 完成。

## 接入原则

- 优先使用公司网关/OIDC，不自行保存密码。
- 浏览器使用 Secure、HttpOnly、SameSite Cookie。
- 不信任客户端传入的 user ID、role 或 group。
- API 和 SSE 使用同一认证与授权逻辑。
- 授权策略按 action + resource 判断，不只判断“是否登录”。
- Task、Skill 修改、运行取消和外部副作用记录操作者 identity。
- 用户 Token 不传给 Agent；需要代理访问时使用服务端短期凭据。

## 推荐角色

- `viewer`：查看允许的模块和自己的任务。
- `operator`：创建、继续和取消任务。
- `skill-admin`：管理模块 Skill 和 Runtime 配置。
- `platform-admin`：管理数据源、集成和审计策略。

公司权限模型更复杂时，在内部 Adapter 把组映射为平台 action，不要让核心代码依赖公司组织结构。
