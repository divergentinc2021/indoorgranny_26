// Vendor dark Android dialog (docs/reference/vendor-screenshots/03-terms-dialog.jpg): black title bar, dark body, two grey buttons.
export default function TermsDialog({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="terms-title" className="fixed top-0 right-0 bottom-0 left-0 bg-black/60 flex items-center justify-center p-3 z-10">
      <div className="w-full max-w-md max-h-full overflow-y-auto bg-gg-dlg text-white border border-gg-summary">
        <h2 id="terms-title" className="bg-black px-[20px] py-[14px] text-[22px] leading-tight">Terms of Service and Privacy</h2>
        <p className="px-[10px] py-[10px] text-[18px] leading-tight">This app records your heart rate, power, cadence and speed during studio rides and stores them on this device. Sessions can be exported as FIT files. Nothing leaves the device unless you export or connect a service.</p>
        <div className="flex p-[10px] bg-gg-pref">
          <button autoFocus className="flex-1 mr-[10px] bg-gg-btn text-black text-[18px] py-2" onClick={onAccept}>Accept</button>
          <button className="flex-1 bg-gg-btn text-black text-[18px] py-2" onClick={onDecline}>Decline</button>
        </div>
      </div>
    </div>
  );
}
