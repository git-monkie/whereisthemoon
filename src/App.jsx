import { useEffect, useRef, useState } from "react";
import SunCalc from "suncalc";

function App() {
  const videoRef = useRef(null);

  const [started, setStarted] = useState(false);
  const [location, setLocation] = useState(null);
  const [moonInfo, setMoonInfo] = useState(null);

  const [heading, setHeading] = useState(0);
  const [pitch, setPitch] = useState(0);

  const baseHeading = useRef(null);
  // basePitch useRef는 더 이상 필요 없으므로 제거합니다.

  const normalizeAngle = (a) => {
    a = a % 360;
    if (a < 0) a += 360;
    return a;
  };

  const startApp = async () => {
    // iOS 기기 등에서 센서 권한 요청
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== "granted") {
          alert("센서 권한이 필요합니다.");
          return;
        }
      } catch (error) {
        console.error(error);
      }
    }
    setStarted(true);
  };

  // 1. 위치 가져오기
  useEffect(() => {
    if (!started) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      },
      (err) => {
        console.error("위치 정보를 가져올 수 없습니다.", err);
        alert("위치 정보 권한이 필요합니다.");
      }
    );
  }, [started]);

  // 2. 카메라 실행 (🔥 버그 3 수정: CSS 대응을 위해 구조 유지)
  useEffect(() => {
    if (!started) return;

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 }, // 더 높은 해상도 시도
          height: { ideal: 1080 },
        },
      })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        console.error("카메라를 켤 수 없습니다.", err);
        alert("카메라 권한이 필요합니다.");
      });
  }, [started]);

  // 3. 달 위치 계산
  useEffect(() => {
    if (!location) return;

    const update = () => {
      const now = new Date();
      const moon = SunCalc.getMoonPosition(
        now,
        location.lat,
        location.lon
      );

      // 호도법(radian)을 도(degree)로 변환
      let az = moon.azimuth * (180 / Math.PI);
      let alt = moon.altitude * (180 / Math.PI);

      // SunCalc 방위각: 남쪽 0, 서쪽 90, 북쪽 180, 동쪽 270
      // 일반적인 나침반: 북쪽 0, 동쪽 90, 남쪽 180, 서쪽 270
      // 보정: 북쪽을 0으로 맞춤
      az = normalizeAngle(az + 180);

      setMoonInfo({
        azimuth: az,
        altitude: alt, // 고도는 절대값 그대로 사용 (하늘 높이)
      });
    };

    update();
    const id = setInterval(update, 5000); // 5초마다 업데이트 (자주 할 필요 없음)
    return () => clearInterval(id);
  }, [location]);

  // 4. 센서 처리 (🔥 버그 1, 2 핵심 수정)
  useEffect(() => {
    if (!started) return;

    const handle = (e) => {
      // e.alpha: 나침반 방향 (0~360)
      // e.beta: 앞뒤 기울기 (-180~180)
      // e.gamma: 좌우 기울기 (-90~90)

      let h = e.alpha || 0;
      let p = e.gamma || 0; // 🔥 [수정] 세로 모드에서는 gamma가 상하 기울기에 더 적합합니다.

      // iOS의 경우 webkitCompassHeading이 있다면 더 정확한 나침반 값을 씁니다.
      if (e.webkitCompassHeading) {
        h = e.webkitCompassHeading;
      }

      // [좌우 방향(Heading)]
      // 사용자가 앱을 켠 순간의 방향을 기준(0)으로 잡습니다.
      if (baseHeading.current === null) {
        baseHeading.current = h;
      }
      h = normalizeAngle(h - baseHeading.current);

      // [상하 방향(Pitch)] 🔥 [수정]
      // 고도는 절대적인 값이므로 사용자의 시작 자세를 기준으로 삼지 않습니다.
      // 폰을 수직으로 세웠을 때 p(gamma) 값이 약 -90이 나옵니다.
      // 이를 고도 계산에 맞게 보정합니다. (폰을 들면 고도가 올라가도록)
      p = -(p + 90);

      setHeading(h);
      setPitch(p);
    };

    window.addEventListener("deviceorientation", handle);
    return () => window.removeEventListener("deviceorientation", handle);
  }, [started]);

  // 5. 화면 좌표 계산 (🔥 단순화 및 보정)
  const getPos = () => {
    if (!moonInfo) return { x: 0, y: 0, visible: false };

    // 좌우 차이 계산 (최단 경로로)
    let azDiff = moonInfo.azimuth - heading;
    if (azDiff > 180) azDiff -= 360;
    if (azDiff < -180) azDiff += 360;

    // 상하 차이 계산
    // 달 고도(0~90) - 폰 기울기(보정됨)
    let altDiff = moonInfo.altitude - pitch;

    // 화면에 그릴 감도 (숫자가 클수록 폰을 조금만 움직여도 달이 많이 움직임)
    const sensitivity = 8;

    // 달이 지평선 아래에 있거나 화면에서 너무 멀어지면 숨김 처리
    const isVisible = moonInfo.altitude > -5 && Math.abs(azDiff) < 50 && Math.abs(altDiff) < 60;

    return {
      x: -azDiff * sensitivity, // 좌우 반전 보정
      y: altDiff * sensitivity, // 고도에 따른 상하 이동
      visible: isVisible
    };
  };

  const pos = getPos();

  // 시작 전 화면
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
          fontFamily: "sans-serif"
        }}
      >
        <button
          onClick={startApp}
          style={{
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
            border: "2px solid rgba(255,255,255,0.3)",
            color: "white",
            fontSize: 20,
            cursor: "pointer",
            backdropFilter: "blur(5px)"
          }}
        >
          <span style={{fontSize: 40}}>🌙</span><br /><br />달님,<br />어디있어요?
        </button>
      </div>
    );
  }

  // AR 화면
  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      position: "relative", // 컨테이너 기준 정립
      backgroundColor: "black" // 카메라 로딩 전 배경
    }}>
      {/* 📷 카메라 (🔥 버그 3 수정: CSS로 화면 전체 꽉 채우기) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "100%",
          height: "100%",
          objectFit: "cover", // 비율 유지하며 꽉 채움
          transform: "translate(-50%, -50%)", // 정중앙 정렬
          zIndex: 0,
        }}
      />

      {/* 🌙 달 (🔥 화면 좌표 개선) */}
      {moonInfo && pos.visible && (
        <div
          style={{
            position: "absolute",
            left: `calc(50% + ${pos.x}px)`,
            top: `calc(50% + ${pos.y}px)`,
            transform: "translate(-50%, -50%)",
            fontSize: "10vw", // 기기 크기에 맞게 달 크기 조정
            zIndex: 2,
            textShadow: "0 0 20px rgba(255, 255, 200, 0.8)", // 달광채 효과
            pointerEvents: "none" // 터치 이벤트 방해 금지
          }}
        >
          🌙
        </div>
      )}

      {/* UI 피드백 (개발용/디버깅용으로 쓰거나 지워도 됨) */}
      {location && moonInfo && (
        <div style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          color: "white",
          background: "rgba(0,0,0,0.5)",
          padding: 10,
          borderRadius: 8,
          fontSize: 12,
          zIndex: 3,
          fontFamily: "monospace"
        }}>
          달 고도: {moonInfo.altitude.toFixed(1)}°<br/>
          폰 기울기: {pitch.toFixed(1)}°
        </div>
      )}
    </div>
  );
}

export default App;