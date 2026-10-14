export default function TermsDialog({ onAccept }: { onAccept: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="terms-title" className="fixed top-0 right-0 bottom-0 left-0 bg-black/80 flex items-center justify-center p-6">
      <div className="bg-white text-black rounded-[15px] border-2 border-gg-bg p-5 max-w-md space-y-3">
        <h2 id="terms-title" className="text-xl text-gg-bg">Terms and privacy</h2>
        <p className="text-sm">This app records your heart rate, power, cadence and speed during studio rides and stores them on this device. Sessions can be exported as FIT files. Nothing leaves the device unless you export or connect a service.</p>
        <button autoFocus className="w-full bg-gg-strip text-white text-[20px] rounded-[15px] border-2 border-gg-bg py-2" onClick={onAccept}>Accept</button>
      </div>
    </div>
  );
}
