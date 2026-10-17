// Class start dialog: same dark Android look as TermsDialog. WARM UP rides free until START CLASS; START CLASS runs the plan now.
export default function StartDialog({ title, onWarmUp, onStartClass, onCancel }: { title: string; onWarmUp: () => void; onStartClass: () => void; onCancel: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="start-title" className="fixed top-0 right-0 bottom-0 left-0 bg-black/60 flex items-center justify-center p-3 z-10">
      <div className="w-full max-w-md max-h-full overflow-y-auto bg-gg-dlg text-white border border-gg-summary">
        <h2 id="start-title" className="bg-black px-[20px] py-[14px] text-[22px] leading-tight">{title}</h2>
        <div className="flex p-[10px] bg-gg-pref">
          <button className="flex-1 mr-[10px] bg-gg-btn text-black text-[18px] font-bold uppercase py-2" onClick={onWarmUp}>Warm up</button>
          <button autoFocus className="flex-1 bg-gg-btn text-black text-[18px] font-bold uppercase py-2" onClick={onStartClass}>Start class</button>
        </div>
        <div className="px-[10px] pb-[10px] bg-gg-pref text-center"><button className="text-gg-summary text-[16px] underline py-1" onClick={onCancel}>Cancel</button></div>
      </div>
    </div>
  );
}
