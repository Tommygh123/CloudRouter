import { QRCodeSVG } from 'qrcode.react';
import { FiWifi } from 'react-icons/fi';

import { buildWifiQrPayload } from '../../services/wifiOnboardingService';

export default function WifiPoster({
  network,
  site,
  qrId = 'cloudrouter-wifi-qr',
}) {
  if (!network) {
    return (
      <div className="flex min-h-[560px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
        Select or create a customer Wi-Fi network to preview its onboarding poster.
      </div>
    );
  }

  const payload =
    buildWifiQrPayload(network);

  const displayName =
    network.display_name ||
    network.ssid ||
    'Internet Access';

  const siteName =
    site?.name || '';

  return (
    <article
      id="cloudrouter-wifi-poster"
      className="mx-auto w-full max-w-[720px] overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-xl"
    >
      <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 px-8 py-9 text-center text-white">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
          <FiWifi className="text-3xl" />
        </div>

        <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-100">
          Wi-Fi Internet Access
        </p>

        <h1 className="mt-3 text-4xl font-black tracking-tight">
          {displayName}
        </h1>

        {siteName && (
          <p className="mt-2 text-sm font-medium text-blue-100">
            {siteName}
          </p>
        )}
      </div>

      <div className="px-8 py-9 text-center">
        <h2 className="text-2xl font-black text-slate-900">
          Scan to connect
        </h2>

        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
          No mobile data is required. Scan the QR code, join{' '}
          <strong>{network.ssid}</strong>, then choose a bundle or enter your voucher when the access page opens.
        </p>

        <div className="mx-auto my-7 inline-flex rounded-[28px] border-8 border-white bg-white p-4 shadow-lg ring-1 ring-slate-200">
          {payload ? (
            <QRCodeSVG
              id={qrId}
              value={payload}
              size={260}
              level="M"
              marginSize={2}
              bgColor="#ffffff"
              fgColor="#0f172a"
              title={`Join ${network.ssid}`}
            />
          ) : null}
        </div>

        <div className="mx-auto grid max-w-lg gap-3 text-left sm:grid-cols-2">
          {[
            ['1', 'Scan QR', 'Use your phone camera.'],
            ['2', `Join ${network.ssid}`, 'Accept the Wi-Fi connection prompt.'],
            ['3', 'Choose access', 'Buy a bundle or enter a voucher.'],
            ['4', 'Get online', 'Your Internet access starts immediately.'],
          ].map(([number, title, detail]) => (
            <div
              key={number}
              className="rounded-2xl bg-slate-50 p-4"
            >
              <div className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white">
                  {number}
                </span>

                <div>
                  <div className="font-bold text-slate-900">
                    {title}
                  </div>

                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    {detail}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {network.customer_message && (
          <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-cyan-100 bg-cyan-50 px-5 py-4 text-sm font-medium text-cyan-900">
            {network.customer_message}
          </div>
        )}

        <div className="mt-8 border-t border-slate-100 pt-5">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
            Wi-Fi network
          </div>

          <div className="mt-1 text-xl font-black text-slate-900">
            {network.ssid}
          </div>

          {network.show_cloudrouter_branding !== false && (
            <div className="mt-6 text-xs font-semibold text-slate-400">
              Powered by <span className="font-black text-blue-600">CloudRouter</span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
