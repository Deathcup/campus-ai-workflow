# ADR 0001：本地开发与团队部署的持久化

状态：Accepted

团队部署使用 PostgreSQL。为了让首版在没有数据库的开发机上也能一条命令启动，未配置 `DATABASE_URL` 时使用原子写入的 JSON Store。两者实现同一个 `DataStore` 接口；Docker Compose 默认启用 PostgreSQL。

JSON Store 只用于单进程开发和演示，不支持多实例并发。新增正式业务实体时应同步扩展 PostgreSQL 表结构，并在需要复杂查询时从当前 JSON payload 列逐步演进为显式列。
