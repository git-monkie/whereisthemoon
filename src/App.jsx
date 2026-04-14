import { useEffect, useRef, useState } from "react";
import SunCalc from "suncalc";

function App() {
  const videoRef = useRef(null);

  const [started, setStarted] = useState(false);
  const [location, setLocation] = useState(null);
  const [moonInfo, setMoonInfo] = useState(null);
  const [moonPhase, setMoonPhase] = useState(null);

  const [heading, setHeading] = useState(0);
  const [pitch, setPitch] = useState(0);

  const smoothHeading = useRef(0);
  const smoothPitch = useRef(0);
  const baseHeading = useRef(null);

  const normalizeAngle = (angle) => {
    angle = angle % 360;
    if (angle < 0) angle += 360;
    return angle;
  };

  const startApp = async () => {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      await DeviceOrientationEvent.requestPermission();
    }
    setStarted(true);
  };

  useEffect(() => {
    if (!started) return;

    navigator.geolocation.getCurrentPosition((pos) => {
      setLocation({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      });
    });
  }, [started]);

  useEffect(() => {
    if (!started) return;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        videoRef.current.srcObject = stream;
      });
  }, [started]);

  useEffect(() => {
    if (!location) return;

    const update = () => {
      const now = new Date();

      const moon = SunCalc.getMoonPosition(
        now,
        location.lat,
        location.lon
      );

      const illum = SunCalc.getMoonIllumination(now);

      let az = moon.azimuth * (180 / Math.PI);
      az = normalizeAngle(az + 180);

      setMoonInfo({
        azimuth: az,
        altitude: moon.altitude * (180 / Math.PI),
      });

      setMoonPhase(illum);
    };

    update();
    const interval = setInterval(update, 2000);
    return () => clearInterval(interval);
  }, [location]);

  useEffect(() => {
    if (!started) return;

    const smooth = (t, c, f = 0.1) => c + (t - c) * f;

    const smoothAngle = (t, c) => {
      let d = t - c;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      return c + d * 0.1;
    };

    const handleOrientation = (e) => {
      const rawHeading = e.alpha || 0;
      const rawPitch = e.beta || 0;

      if (baseHeading.current === null) {
        baseHeading.current = rawHeading;
      }

      let corrected = rawHeading - baseHeading.current;
      corrected = normalizeAngle(corrected);

      smoothHeading.current = smoothAngle(
        corrected,
        smoothHeading.current
      );
      smoothPitch.current = smooth(rawPitch, smoothPitch.current);

      setHeading(smoothHeading.current);
      setPitch(smoothPitch.current);
    };

    window.addEventListener("deviceorientation", handleOrientation);
    return () =>
      window.removeEventListener("deviceorientation", handleOrientation);
  }, [started]);

  const getMoonScreenPosition = () => {
    if (!moonInfo) return { x: 0, y: 0 };

    let azDiff = moonInfo.azimuth - heading;
    if (azDiff > 180) azDiff -= 360;
    if (azDiff < -180) azDiff += 360;

    // 🔥 핵심 수정 (상하 반전 해결)
    let altDiff = moonInfo.altitude + pitch;

    return {
      x: -azDiff * 4,
      y: altDiff * 5,
    };
  };

  const pos = getMoonScreenPosition();

  const getMoonPhase = (phase) => {
    if (phase < 0.03 || phase > 0.97) return "🌑";
    if (phase < 0.22) return "🌒";
    if (phase < 0.28) return "🌓";
    if (phase < 0.47) return "🌔";
    if (phase < 0.53) return "🌕";
    if (phase < 0.72) return "🌖";
    if (phase < 0.78) return "🌗";
    return "🌘";
  };

  if (!started) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          background: "linear-gradient(#0b0c2a, #1a1c4a)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 3,
        }}
      >
        <button
          onClick={startApp}
          style={{
            width: 200,
            height: 200,
            borderRadius: "50%",
            border: "none",
            background: "rgba(255,255,255,0.1)",
            boxShadow: "0 0 30px rgba(255,255,200,0.5)",
            color: "white",
            fontSize: 18,
            zIndex: 3,
          }}
        >
          🌙
          <div style={{ marginTop: 10 }}>
            달님,<br />어디있어요?
          </div>
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* 카메라 */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          position: "fixed",
          width: "100vw",
          height: "100vh",
          objectFit: "cover",
          zIndex: 0,
        }}
      />

      {/* 어둡게 */}
      <div
        style={{
          position: "fixed",
          width: "100%",
          height: "100%",
          background: "rgba(0,0,20,0.3)",
          zIndex: 1,
        }}
      />

      {/* 달 */}
      {moonInfo && (
        <div
          style={{
            position: "absolute",
            left: `calc(50% + ${pos.x}px)`,
            top: `calc(50% + ${pos.y}px)`,
            transform: "translate(-50%, -50%)",
            fontSize: "55px",
            zIndex: 3,
            filter: "drop-shadow(0 0 10px rgba(255,255,200,0.8))",
          }}
        >
          {moonPhase && getMoonPhase(moonPhase.phase)}
        </div>
      )}
    </div>
  );
}

export default App;