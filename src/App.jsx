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

  // 🔧 각도 정규화
  const normalizeAngle = (angle) => {
    angle = angle % 360;
    if (angle < 0) angle += 360;
    return angle;
  };

  // 📱 시작 (센서 허용)
  const startApp = async () => {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      await DeviceOrientationEvent.requestPermission();
    }
    setStarted(true);
  };

  // 📍 위치
  useEffect(() => {
    if (!started) return;

    navigator.geolocation.getCurrentPosition((pos) => {
      setLocation({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      });
    });
  }, [started]);

  // 📷 카메라
  useEffect(() => {
    if (!started) return;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        videoRef.current.srcObject = stream;
      });
  }, [started]);

  // 🌙 달 계산
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

  // 🧭 센서 처리
  useEffect(() => {
    if (!started) return;

    const smooth = (target, current, factor = 0.1) =>
      current + (target - current) * factor;

    const smoothAngle = (target, current) => {
      let diff = target - current;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      return current + diff * 0.1;
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

  // 🌙 화면 좌표 계산
  const getMoonScreenPosition = () => {
    if (!moonInfo) return { x: 0, y: 0 };

    let azDiff = moonInfo.azimuth - heading;
    if (azDiff > 180) azDiff -= 360;
    if (azDiff < -180) azDiff += 360;

    let altDiff = moonInfo.altitude - pitch;

    return {
      x: -azDiff * 4,
      y: -altDiff * 5,
    };
  };

  const pos = getMoonScreenPosition();

  // 🌙 위상
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

  // 🌌 인트로 화면
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
          color: "white",
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
            backdropFilter: "blur(10px)",
            boxShadow: "0 0 30px rgba(255,255,200,0.5)",
            color: "white",
            fontSize: "18px",
            cursor: "pointer",
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

  // 🌙 메인 AR 화면
  return (
    <div>
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
        }}
      />

      {/* 어둡게 */}
      <div
        style={{
          position: "fixed",
          width: "100%",
          height: "100%",
          background: "rgba(0,0,20,0.3)",
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
            filter: "drop-shadow(0 0 10px rgba(255,255,200,0.8))",
          }}
        >
          {moonPhase && getMoonPhase(moonPhase.phase)}
        </div>
      )}

      {/* 화살표 */}
      <div
        style={{
          position: "absolute",
          bottom: "20%",
          left: "50%",
          transform: `translateX(-50%) rotate(${moonInfo?.azimuth - heading}deg)`,
          fontSize: "40px",
        }}
      >
        🧭
      </div>

      {/* 나침반 */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          width: "100%",
          textAlign: "center",
          color: "white",
          letterSpacing: "10px",
          transform: `rotate(${-heading}deg)`,
        }}
      >
        N • E • S • W
      </div>

      {/* 정보 */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          color: "white",
          background: "rgba(255,255,255,0.1)",
          backdropFilter: "blur(10px)",
          padding: 12,
          borderRadius: 16,
          fontSize: 14,
        }}
      >
        <div>방향: {heading.toFixed(1)}°</div>
        <div>기울기: {pitch.toFixed(1)}°</div>
        <div>밝기: {(moonPhase?.fraction * 100).toFixed(1)}%</div>
      </div>
    </div>
  );
}

export default App;