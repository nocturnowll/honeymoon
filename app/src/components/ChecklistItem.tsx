export function ChecklistItem({ checked, label, due, overdue, onChange }: { checked: boolean; label: string; due?: string; overdue?: boolean; onChange: (value: boolean) => void }) {
  return <label className={`list-item ${overdue ? 'overdue' : ''}`}><span className="check-hit"><input type="checkbox" checked={checked} aria-label={`${checked ? 'Uncheck' : 'Check'} ${label}`} onChange={e => { onChange(e.target.checked); }} /></span><span><b>{label}</b>{due && <small className="mono">{overdue ? 'OVERDUE · ' : ''}{due}</small>}</span></label>;
}
