export default function TermsDialog({ onAccept }: { onAccept: () => void }) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/80 flex items-center justify-center p-6">
      <div className="bg-gg-panel border border-gg-line rounded p-5 max-w-md space-y-3">
        <h2 className="text-xl">Terms and privacy</h2>
        <p className="text-gg-muted text-sm">This app records your heart rate, power, cadence and speed during studio rides and stores them on this device. Sessions can be exported as FIT files. Nothing leaves the device unless you export or connect a service.</p>
        <button className="w-full bg-gg-accent text-black font-semibold rounded py-2" onClick={onAccept}>Accept</button>
      </div>
    </div>
  );
}
