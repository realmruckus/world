# 人生模拟器后续 Codex 自我审核矩阵

## 目的

本文将 `docs/life-simulator-codex-self-review.md` 的通用自我审核流程应用到后续 Codex B、C、D 批次。

任何后续 Codex 任务在提交人工审核前，必须：

1. 至少执行两轮自我审核；
2. 对阻塞与必修项先补失败测试再修复；
3. 最多连续三轮自我修复；
4. 阻塞项与必修项均为 0；
5. 完整 Regression、CI 和任务特定验证全部通过；
6. PR 保持 Draft，不自动合并；
7. 明确列出仍需人工判断的内容。

Codex 自我审核不能替代 RR-114、RR-116 或 RR-118。

## 通用 Mac 启动指令

在 Codex Mac 应用中打开 `realmruckus/world`，发送：

```text
执行 <ISSUE>。

先读取该 Issue、对应人工审核 Issue、当前阻塞关系、WORLD MVP 最新 Project Status、dependencies.lock.json、core 固定提交中的 docs/ai-workflow.md、docs/life-simulator-product-scope.md、docs/life-simulator-codex-execution-plan.md、docs/life-simulator-codex-self-review.md、docs/life-simulator-codex-task-review-matrix.md，以及该任务指定的代码、数据、测试、PR 和评论。

严格按正式文档执行 Red → Green → Regression → Refactor。实现完成后至少进行两轮自我审核和最多三轮修复迭代。只有阻塞项和必修项均为 0、完整回归与 CI 全部通过、任务特定验证真实执行后，才提交对应人工审核 Issue。保持 Draft PR，不自动合并，不自行批准人工审核。
```

## Codex B：RR-113 自我审核

对应人工审核：RR-114。

### 必须检查

- IdentityBuilder 每一步可前进、返回、修改和最终确认；
- Gender、Zodiac、Family、Parent Job 为独立选择，不发生隐式绑定；
- ProfileCardViewModel 只读取正式状态，不复制业务逻辑；
- LifeChoiceCardViewModel 只提交 `choiceId`；
- Mulligan 由 Deck/Offer Model 决定，组件不自行随机；
- 展开、放大、关闭、打出、禁用状态和错误提示完整；
- 连续点击、双击、触摸取消、页面刷新不会重复提交；
- 320px、常规手机和桌面布局无整页跳动；
- Safe Area、Safari 工具栏、长文本和 44×44 CSS px 触控区有测试；
- 键盘路径与 Reduced Motion 完整；
- 只使用占位 Asset ID 和中性 Token；
- 不引入正式视觉、卡牌材质或未经批准文案。

### 反例

至少覆盖：

- 中途返回修改家庭；
- 无可选卡牌；
- 换牌次数耗尽；
- 禁用卡被点击或拖出；
- 卡牌详情打开时刷新；
- 动画关闭与开启结果一致；
- 超长标题、描述和禁用原因；
- 320px 宽度与横屏；
- 键盘焦点丢失；
- 同一 choice 重复提交。

### 退出条件

- UI Contract、View Model、Life Engine 和页面测试全部通过；
- 至少生成桌面、320px 和常规手机证据；
- 无范围外 Engine 或正式视觉修改；
- 人工保留项明确列出：信息层级、真实卡牌感、文案与最终触控体验。

## Codex C：RR-115 自我审核

对应人工审核：RR-116。

### 必须检查

- Asset Manifest 字段、版本、来源、许可和审核状态完整；
- 所有组件只引用 Asset ID，不硬编码路径；
- 重复、悬空和未知 Asset ID 失败关闭；
- 缺图回退不会导致空白、布局崩溃或信息丢失；
- 确定性人物与场景选择可重复；
- 懒加载、缓存和首屏预算有真实测量；
- Presentation State Machine 顺序完整；
- 动画中断、刷新和重复点击不会重复结算；
- Reduced Motion 与正常动效的 Engine 结果一致；
- 低性能降级保留所有文字与操作；
- 仅使用原创占位 SVG、几何图形和中性 Token；
- 不生成或批准正式图片、声音、卡框和动画风格。

### 反例

至少覆盖：

- Manifest 中重复 ID；
- 文件不存在；
- MIME 或尺寸错误；
- 资源加载超时；
- 缓存失效；
- 动画中间刷新；
- Resolve 后重复 Commit；
- 无图片模式；
- Reduced Motion；
- 低内存或慢速网络降级。

### 退出条件

- 资源、页面、Life Engine 和性能 Contract 测试全部通过；
- 性能结论有机器可读报告；
- 动效开启/关闭状态结果相同；
- 人工保留项明确列出：视觉锚点、图片质量、裁切、许可、原创性和演出节奏。

## Codex D：RR-117 自我审核

对应人工审核：RR-118。

### 必须检查

- 内容编辑器结构化 JSON round-trip 无数据丢失；
- Draft → Validated → Previewed → Reviewed → Approved 状态迁移合法；
- Codex 与 AI Adapter 无权自行批准内容；
- 未批准内容无法写入正式目录或部署路径；
- Schema、Validator、编辑器表单和正式 Loader 一致；
- provenance、模型、Prompt 版本、输入、内容哈希和审核状态完整；
- 去重、相似度和背景一致性检查可重复；
- deterministic fixture provider 结果稳定；
- 真实模型接入默认关闭且独立配置；
- Simulation 预览与正式 Engine 一致；
- 浏览器、移动端、刷新恢复、导入导出和发布阻断全部自动测试；
- 敏感内容只能标记并交人工判断，不得自动批准。

### 反例

至少覆盖：

- 未批准草稿尝试发布；
- 伪造 approved 状态；
- 缺失 provenance；
- Prompt 版本变化但内容哈希未更新；
- 重复候选；
- 导入未知 Schema；
- 编辑器中途刷新；
- Simulation 预览与正式 Loader 不一致；
- 浏览器离线或存储失败；
- 移动端长文档和 Safe Area；
- 发布回滚。

### 退出条件

- Node、浏览器、移动端、资源、Simulation 和 Life Engine 回归全部通过；
- 非法发布阻断有实际演示和测试；
- 至少一个真实候选批次可由人工走完整审核流程；
- 人工保留项明确列出：模型批准、Prompt 质量、内容真实性、敏感内容、正式批准与上线决定。

## 人工审核交接

每个 Codex 任务完成后必须在对应人工审核 Issue 中提交：

- Base、Head、PR 和审核轮次；
- 验收追踪矩阵；
- 阻塞、必修、建议清单；
- 自我修复 Commit；
- 全部测试、CI 和任务特定报告；
- 未执行项；
- 需要人工判断的内容；
- “可提交人工审核”或“不可提交人工审核”的明确结论。

人工审核仍需重新读取完整 Diff 和证据，不得直接采信 Codex 自审结论。