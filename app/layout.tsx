export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>WHOOP + Nutrition Tracker</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style={{ margin: 0, background: '#0a0a0a', color: '#e5e5e5', fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
          {children}
        </div>
      </body>
    </html>
  );
}
