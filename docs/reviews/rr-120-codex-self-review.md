# RR-120 Codex 自我审核记录

## 自我审核对象

- Issue：RR-120
- 人工审核入口：RR-112 第三轮
- PR：#5（Open / Draft / 未合并）
- PR 原 Head：`0c2b46a0c5613ab1e4b32b64fa8f657b814ad276`
- Base：`main@ce0f7d77328ca83bb77535f5d7ba0ae30eee8a73`
- 实现与远端验证 Head：`8c5c63363d52d5bae41644193dfc8e155a74081d`
- 修复分支：`codex/rr-112-fix-2`
- 审核轮次：三轮；前两轮各产生一次反例驱动修复，第三轮为完整 Diff 复核

## 需求追踪矩阵

| 验收项 | 实现 | 测试/命令 | 结果 | 证据 |
|---|---|---|---|---|
| 全部成功计数 | `runContractSimulation` | `RR-120 reports successful execution counts exactly` | 通过 | requested=4, executed=4, failed=0, completed |
| 部分失败计数 | 可控 `executeLife` seam | `RR-120 reports partial failures...` | 通过 | requested=4, executed=2, failed=2, errorSummary=2 |
| 全部失败计数 | 同上 | `RR-120 reports complete failure...` | 通过 | requested=3, executed=0, failed=3, status=failed |
| 计数/状态/错误守恒 | `validateSimulationReport` | 四类篡改反例 | 通过 | count、status、summary、error drift 均拒绝 |
| 并行报告一致性 | `mergeSimulationReports` | 全失败 worker 与伪造 worker 反例 | 通过 | 合并前逐份校验，合并后再次校验 |
| 父母职业唯一权威源 | Parent NPC `parentJobId` | Identity/NPC 一致、覆盖、悬空、槽位、重放 | 通过 | Identity 只读 NPC；selection 覆盖失败关闭 |
| 最新 main 对齐 | merge commit `1d88bb9` | merge-base、完整 Diff、GitHub mergeable | 通过 | Base 为 `ce0f7d7`，PR `mergeable:true` |
| CI 门禁 | workflow RR-120 step | workflow Contract 测试 + GitHub Actions | 通过 | `tests/life-content-rr120.test.mjs` 显式执行 |
| 10,000 人生 | Adapter/Runner/Report | 两次独立 10,000、`cmp`、SHA-256 | 通过 | 10,000/10,000、失败 0、逐字节一致 |
| 分布处理边界 | 路径 B | Diff/报告/Linear 交接 | 通过执行边界 | 未改正式 Event、Ending、Metric 或评分；等待 RR-112 人工决定 |

## Red → Green → Regression → Refactor

### 初始 Red

- Commit：`ca2ef7c`
- 命令：`node --test tests/life-content-contract-rr119.test.mjs tests/life-content-simulation-adapter-v1.test.mjs tests/life-content-rr120.test.mjs`
- 结果：19 项中 12 通过、7 失败，退出码 1。
- 失败原因：Adapter 不接受可控执行 seam，固定把 requested 写成 executed；Identity 仍要求 selection 职业数组而非读取 NPC 权威数据。

### Green

- Commit：`0485c8c`
- 结果：目标测试 19/19 通过。
- 修复：真实成功数、completed/completed_with_errors/failed 三态、语义守恒校验、Parent NPC 单一职业权威源。

### Refactor

- Commit：`288de25`
- 内容：移除已废弃的职业选择索引与测试局部变量；行为不变。
- 结果：目标测试 23/23 通过。

## 第一轮：实现者视角

- 冻结 Head：`0485c8c`
- 发现必修：并行 CLI 保留旧合并逻辑；所有 worker 失败时仍会标记 `completed_with_errors`，且合并结果没有走同一语义 Validator。
- 失败测试 Commit：`3864cd0`，6 项中 1 项按目标失败，退出码 1。
- 修复 Commit：`51037a2`。
- 修复结果：单进程和并行路径共享 `mergeSimulationReports` 与 `validateSimulationReport`；全失败保持 `failed`。

## 第二轮：审查者视角

- 冻结 Head：`51037a2`
- 发现必修 1：并行合并前信任 worker 报告，矛盾的 worker 计数可能被聚合参数掩盖。
- 发现必修 2：CI 尚未显式执行 RR-120 测试。
- 失败测试 Commit：`0d3cea2`，9 项中 7 通过、2 按目标失败，退出码 1。
- 修复 Commit：`471da17`；workflow 提交：`8c5c633`。
- 修复结果：worker 报告逐份失败关闭；CI 显式运行 RR-120 测试并执行 RR-120 10,000-life。

## 第三轮：完整 Diff 复核

- 复核范围：`origin/main...8c5c633` 完整 Diff、全部 RR-111/RR-119/RR-120 Commit、Fixture、Schema、Adapter、报告、Runner、CI 与测试。
- RR-120 修改范围只涉及 Contract 身份组合、Simulation Adapter/Runner/Report、测试、CI 与证据。
- 没有修改正式年度/恋爱/中断事件、Ending rules、Metric/评分、时间模型、Command 原子语义、Save、UI、视觉或 approved 内容。
- PR 已对齐最新 main；没有冲突覆盖或范围外删除。
- 候选数据仍位于 `data/fixtures/` 且 status 为 `fixture`。
- 阻塞：0。
- 必修：0。
- 建议：0（分布异常属于明确的人工保留项，不伪装为建议或已解决）。

## 完整回归

- RR-120：9/9 通过。
- RR-119 + Adapter + RR-120：23/23 通过。
- 全部 Life：`node --test tests/life-*.test.mjs`，41 个 Node 测试入口通过，0 失败。
- 仓库回归：`npm test`，28/28 通过。
- `npm run check`：通过。
- 全部 `js/*.js`、`scripts/*.mjs` 与 Life tests 的 `node --check`：通过。
- Fixture、报告 JSON、实际 Contract Schema+semantic 与 Report Schema+semantic：通过。
- GitHub Actions：Life Engine Tests #61，success；RR-120 tests、CI 10,000-life 与 UI step 全部成功。
- Vercel：Head `8c5c633` Preview Ready。
- PR：Open / Draft / 未合并 / `mergeable:true`。

## 10,000 人生 Simulation

- 两次独立运行：`--count 10000 --seed-start 119000 --workers 8`。
- 两次均为 requested=10,000、executed=10,000、failed=0、status=completed，退出码 0。
- 两份机器报告逐字节一致。
- 报告：`reports/life-content-simulation-10000-v1.json`。
- SHA-256：`734668ba412cec0a4ed48b22bcd7ea1ea303cb56f938c7d95b6f7b345c2033b2`。
- policy：`rr-120-adapter-v1`。
- `ordinary_complete=10000`。
- event coverage：`0.36363636363636365`（约 36.36%）。
- repeat rate：`0.9085365853658537`（约 90.85%）。
- `annual_quiet_year=530000`。

## 分布路径 B

RR-120 没有获得修改 RR-96/RR-100 正式内容的授权，因此采用路径 B：

- 不修改正式事件、Ending、Metric、评分或权重；
- 不隐藏、不重命名、不归一化异常分布；
- 建议 RR-112 仅在人工明确调整闸门后批准 Contract/Adapter；
- 内容分布校准保留给 RR-96/RR-100 的独立实现与人工审核；
- 未获人工批准前，不把 RR-112 标记通过，也不允许启动 RR-113。

## 需要人工审核

- 是否调整 RR-112 的当前分布闸门，仅批准 Contract/Adapter 边界；
- 是否把 `ordinary_complete`、事件覆盖、重复率和 quiet-year 校准正式保留给 RR-96/RR-100；
- Parent NPC 作为职业唯一权威源是否符合后续 P18 身份构筑方向；
- 家庭、职业、资源 Fixture 的合理性、代表性与偏见风险；
- 是否允许 PR #5 后续合并。

## 自我审核结论

- RR-120 工程阻塞：0。
- RR-120 工程必修：0。
- 可提交 RR-112 第三轮人工审核，但不表示 RR-112、正式内容或 PR 已批准。
- PR 必须继续保持 Draft，禁止自动合并。
