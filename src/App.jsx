import { useEffect, useState } from "react";
import SunCalc from "suncalc";

function App() {
  const [location, setLocation] = useState(null);
  const [moonInfo, setMoonInfo] = useState(null);
  const [heading, setHeading] = useState(null);
  const [moonPhase, setMoonPhase] = useState(null);

  // 📍 위치 가져오기
  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setLocation({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      });
    });
  }, []);

  // 🌙 달 위치 + 위상 계산
  useEffect(() => {
    if (!location) return;

    const now = new Date();

    // 위치
    const moon = SunCalc.getMoonPosition(
      now,
      location.lat,
      location.lon
    );

    const azimuth = moon.azimuth * (180 / Math.PI);
    const altitude = moon.altitude * (180 / Math.PI);

    setMoonInfo({ azimuth, altitude });

    // 위상
    const illum = SunCalc.getMoonIllumination(now);
    setMoonPhase(illum);
  }, [location]);

  // 🧭 방향 감지
  useEffect(() => {
    const handleOrientation = (event) => {
      setHeading(event.alpha);
    };

    window.addEventListener("deviceorientation", handleOrientation);

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, []);

  // 🧠 방향 텍스트 변환
  const getDirection = (azimuth) => {
    if (azimuth > -45 && azimuth <= 45) return "남쪽";
    if (azimuth > 45 && azimuth <= 135) return "서쪽";
    if (azimuth <= -45 && azimuth > -135) return "동쪽";
    return "북쪽";
  };

  // 👉 내 방향 vs 달 방향 비교
  const getRelativeDirection = () => {
    if (!moonInfo || heading == null) return "";

    const diff = moonInfo.azimuth - heading;

    if (diff > 20) return "👉 오른쪽에 있음";
    if (diff < -20) return "👈 왼쪽에 있음";
    return "👆 정면에 있음";
  };

  // 🌙 달 위상 텍스트
  const getMoonPhaseName = (phase) => {
    if (phase < 0.03 || phase > 0.97) return "🌑 신월";
    if (phase < 0.22) return "🌒 초승달";
    if (phase < 0.28) return "🌓 상현달";
    if (phase < 0.47) return "🌔 상현 이후";
    if (phase < 0.53) return "🌕 보름달";
    if (phase < 0.72) return "🌖 하현 이전";
    if (phase < 0.78) return "🌗 하현달";
    return "🌘 그믐달";
  };

  // 📱 iOS 센서 권한 요청
  const requestPermission = async () => {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      await DeviceOrientationEvent.requestPermission();
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>🌙 달 위치 + 모양</h2>

      <button onClick={requestPermission}>
        📱 센서 권한 허용 (아이폰 필수)
      </button>

      {!location && <p>📍 위치 가져오는 중...</p>}

      {location && (
        <p>
          위치: {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
        </p>
      )}

      {moonInfo && (
        <>
          <p>방위각: {moonInfo.azimuth.toFixed(2)}°</p>
          <p>고도: {moonInfo.altitude.toFixed(2)}°</p>
          <p>방향: {getDirection(moonInfo.azimuth)}</p>
        </>
      )}

      {heading !== null && (
        <p>내 방향: {heading.toFixed(2)}°</p>
      )}

      <h3>{getRelativeDirection()}</h3>

      {moonPhase && (
        <>
          <h3>🌙 달 모양</h3>
          <p>{getMoonPhaseName(moonPhase.phase)}</p>
          <p>밝기: {(moonPhase.fraction * 100).toFixed(1)}%</p>
        </>
      )}
    </div>
  );
}

export default App;