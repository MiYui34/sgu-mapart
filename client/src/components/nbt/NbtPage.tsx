import { useMemo, useState } from 'react'
import { buildTree, type TrimDir, type TrimFolder, type TrimSort } from '@shared/mapart/nbtTrim'
import { Shell } from '../layout/Navbar'
import { Check, Radio } from '../ui/Choice'
import { trimZip } from '../../nbt/trimZip'

const DIRECTIONS: Array<{ value: TrimDir; label: string }> = [
  { value: 'NS', label: '从北到南' },
  { value: 'SN', label: '从南到北' },
  { value: 'EW', label: '从东到西' },
  { value: 'WE', label: '从西到东' },
]

export default function NbtPage() {
  const [file, setFile] = useState<File | null>(null)
  const [sort, setSort] = useState<TrimSort>('col')
  const [folder, setFolder] = useState<TrimFolder>('none')
  const [merge, setMerge] = useState(false)
  const [dir, setDir] = useState<TrimDir>('NS')
  const [full, setFull] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [showProgress, setShowProgress] = useState(false)
  const [log, setLog] = useState('等待输入。')
  const [output, setOutput] = useState<Map<string, Uint8Array> | null>(null)
  const [count, setCount] = useState(0)

  const tree = useMemo(() => output ? buildTree([...output.keys()], full) : [], [output, full])
  const summary = output ? describe(count, output.size, sort, folder, merge, dir, full, tree) : log

  const process = async () => {
    if (!file) {
      setLog('请先选择 zip 文件。')
      setOutput(null)
      return
    }
    setBusy(true)
    setOutput(null)
    setShowProgress(true)
    setProgress(0)
    setProgressLabel('读取 zip')
    setLog('处理中。')
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const result = await trimZip(bytes, { sort, folder, merge, dir }, ({ pct, label }) => {
        setProgress(pct)
        setProgressLabel(label)
      })
      setOutput(result.files)
      setCount(result.count)
    } catch (error) {
      setLog(`处理失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const download = async () => {
    if (!output) return
    const { zipSync } = await import('fflate')
    const files: Record<string, Uint8Array> = {}
    for (const [path, bytes] of output) files[path] = bytes
    const zipped = zipSync(files)
    const blob = new Blob([new Uint8Array(zipped)], { type: 'application/zip' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const base = file?.name.replace(/\.zip$/i, '') || 'nbt'
    link.href = url
    link.download = `${base}_output.zip`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Shell>
      <div className="nbt-layout">
        <section className="glass-panel stack">
          <div>
            <h2>NBT 精简与合并</h2>
            <p className="muted">上传包含 name_x_y.nbt 的 zip。只保留地毯所在范围，也可以把相邻两张按方向拼在一起。</p>
          </div>
          <div>
            <label className="form-label">输入 zip</label>
            <label className="file-pick">
              <input type="file" accept=".zip,application/zip" onChange={(event) => {
                setFile(event.target.files?.[0] ?? null)
              }} />
              <span className="btn secondary">{file ? file.name : '选择 zip'}</span>
            </label>
          </div>
          <div>
            <h3>排序顺序</h3>
            <div className="choice-row">
              <Radio name="nbt-sort" value="row" checked={sort === 'row'} onChange={(value) => setSort(value as TrimSort)}>行优先（按 y 再 x）</Radio>
              <Radio name="nbt-sort" value="col" checked={sort === 'col'} onChange={(value) => setSort(value as TrimSort)}>列优先（按 x 再 y）</Radio>
            </div>
          </div>
          <div>
            <h3>分文件夹</h3>
            <div className="choice-row">
              <Radio name="nbt-folder" value="none" checked={folder === 'none'} onChange={(value) => setFolder(value as TrimFolder)}>无</Radio>
              <Radio name="nbt-folder" value="row" checked={folder === 'row'} onChange={(value) => setFolder(value as TrimFolder)}>按行（y00、y01）</Radio>
              <Radio name="nbt-folder" value="col" checked={folder === 'col'} onChange={(value) => setFolder(value as TrimFolder)}>按列（x00、x01）</Radio>
            </div>
          </div>
          <Check checked={merge} onChange={setMerge}>启用合并</Check>
          <div className="choice-row">
            {DIRECTIONS.map((item) => (
              <Radio key={item.value} name="nbt-dir" value={item.value} checked={dir === item.value} disabled={!merge} onChange={(value) => setDir(value as TrimDir)}>{item.label}</Radio>
            ))}
          </div>
          <div>
            <h3>预览</h3>
            <Check checked={full} onChange={setFull}>完整预览</Check>
          </div>
          <div className="segment">
            <button className="btn" type="button" disabled={busy} onClick={process}>{busy ? '处理中' : '处理并预览'}</button>
            <button className="btn secondary" type="button" disabled={!output} onClick={download}>下载 ZIP</button>
          </div>
          {showProgress && (
            <div>
              <p className="muted">{progressLabel}（{progress}%）</p>
              <div className="progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </section>
        <section className="glass-panel nbt-log">
          <pre>{summary}</pre>
        </section>
      </div>
    </Shell>
  )
}

function describe(
  count: number,
  outputCount: number,
  sort: TrimSort,
  folder: TrimFolder,
  merge: boolean,
  dir: TrimDir,
  full: boolean,
  tree: string[],
): string {
  const sortText = sort === 'row' ? '行优先(y,x)' : '列优先(x,y)'
  const folderText = folder === 'row' ? '按行(y00…)' : folder === 'col' ? '按列(x00…)' : '不分'
  const dirText = DIRECTIONS.find((item) => item.value === dir)?.label ?? dir
  const mergeText = merge ? `合并：启用（${dirText}）` : '合并：关闭'
  return [
    `解析 ${count} 个 nbt 文件，输出 ${outputCount} 个文件`,
    `排序：${sortText}；分文件夹：${folderText}；${mergeText}；预览：${full ? '完整' : '截断(每层前3项)'}`,
    '',
    '===== 输出结构预览 =====',
    ...tree,
  ].join('\n')
}
