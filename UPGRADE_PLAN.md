# API 테스터 업그레이드 계획

## 현황 비교

### index.html (현재 버전)
- 단일 페이지 레이아웃
- 기본적인 다크 테마
- 개별 API 테스트 실행
- 테스트 히스토리 저장 (BaseURL + 테스트 이름 기준)
- 테스트 이름 자동완성

### index2.html (참고 버전)
- 사이드바 + 메인 영역 2단 레이아웃
- 세련된 다크 테마 (CSS 변수 시스템)
- JetBrains Mono 코드 폰트
- 실시간 통계 칩 (성공/실패/스킵/대기)
- API 그룹별 트리 구조
- 다중 계정 동시 관리
- 전체 테스트 시나리오 자동 실행
- 프로그레스 바
- 웹소켓 테스트 지원
- 계정 이력 관리

---

## 1. UI/UX 개선 사항

### 1.1 레이아웃 변경
```
┌──────────────────────────────────────────────────────────┐
│ Header: API 테스터 + 통계 칩                              │
├─────────────┬────────────────────────────────────────────┤
│             │                                            │
│  사이드바    │              메인 영역                     │
│  - API 목록  │  - 테스트 설정                            │
│  - 그룹 분류 │  - 결과 표시                              │
│  - 상태 표시 │                                           │
│             │                                            │
└─────────────┴────────────────────────────────────────────┘
```

### 1.2 디자인 시스템
- CSS 변수 기반 컬러 시스템 도입
- HTTP 메서드별 색상 코드 통일
  - GET: 초록(#34d399)
  - POST: 파랑(#6c8cff)
  - PUT: 노랑(#fbbf24)
  - PATCH: 보라(#a78bfa)
  - DELETE: 빨강(#f87171)
- JetBrains Mono 폰트 적용 (코드 가독성)
- 결과 카드 애니메이션 추가

### 1.3 통계 대시보드
- 실시간 테스트 상태 칩 표시
  - 성공(Pass) / 실패(Fail) / 스킵(Skip) / 대기(Pending)
- 전체 실행 시 프로그레스 바

---

## 2. 기능 업그레이드

### 2.1 테스트 컬렉션 관리
**현재**: 개별 테스트만 실행
**개선**: 테스트 컬렉션(시나리오) 기능 추가

```javascript
// 컬렉션 구조 예시
{
  "name": "회원 API 테스트",
  "tests": [
    { "name": "회원가입", "method": "POST", "endpoint": "/register/", ... },
    { "name": "로그인", "method": "POST", "endpoint": "/login/", ... },
    { "name": "프로필 조회", "method": "GET", "endpoint": "/profile/", ... }
  ]
}
```

기능:
- 테스트 순차 실행
- 테스트 간 데이터 전달 (이전 응답값 활용)
- 컬렉션 가져오기/내보내기 (JSON)

### 2.2 환경 변수 시스템
**현재**: Base URL, Token만 저장
**개선**: 환경 변수 관리 기능

```javascript
// 환경 설정 예시
{
  "development": {
    "BASE_URL": "http://localhost:8000",
    "API_KEY": "dev-key-123"
  },
  "production": {
    "BASE_URL": "https://api.example.com",
    "API_KEY": "prod-key-456"
  }
}
```

- 환경 전환 드롭다운
- 변수 참조: `{{BASE_URL}}/api/users`

### 2.3 다중 인증 관리
**현재**: 단일 토큰만 관리
**개선**: 여러 계정/토큰 동시 관리

기능:
- 계정 슬롯 (계정1, 계정2, ...)
- 계정별 토큰 자동 저장
- 테스트 시 사용할 계정 선택
- 계정 이력 관리 (생성된 계정 저장)

### 2.4 응답 데이터 체이닝
**현재**: 수동으로 응답값 복사/붙여넣기
**개선**: 자동 변수 추출 및 재사용

```javascript
// 로그인 응답에서 토큰 자동 추출
{
  "extract": {
    "accessToken": "$.access_token",
    "userId": "$.user.id"
  }
}

// 다음 요청에서 사용
{
  "headers": {
    "Authorization": "Bearer {{accessToken}}"
  }
}
```

### 2.5 테스트 검증 강화
**현재**: 상태 코드 + 필드 존재 확인
**개선**: 다양한 검증 방식 추가

```javascript
{
  "assertions": [
    { "type": "status", "expected": 200 },
    { "type": "json_path", "path": "$.data.length", "operator": "gt", "value": 0 },
    { "type": "contains", "path": "$.message", "value": "성공" },
    { "type": "schema", "schema": "UserResponse" },
    { "type": "response_time", "max_ms": 1000 }
  ]
}
```

### 2.6 웹소켓 테스트 지원
**현재**: REST API만 지원
**개선**: 웹소켓 연결 테스트 추가

기능:
- WS/WSS 연결
- 메시지 송수신
- 연결 상태 모니터링
- 타임아웃 설정

### 2.7 코드 스니펫 생성
테스트 결과를 코드로 변환:
- cURL 명령어
- JavaScript (fetch)
- Python (requests)

---

## 3. 사이드바 기능

### 3.1 API 트리 구조
```
📁 회원 API
  ├─ POST 회원가입 ●
  ├─ POST 로그인 ●
  └─ GET 프로필 ○

📁 게시판 API
  ├─ GET 목록 ●
  ├─ POST 작성 ✕
  └─ DELETE 삭제 ○
```

- 그룹 접기/펼치기
- 드래그 앤 드롭 정렬
- 상태 아이콘 (성공●, 실패✕, 대기○)

### 3.2 빠른 실행
- 사이드바에서 클릭 시 즉시 실행
- 전체 실행 버튼
- 실패한 것만 재실행

---

## 4. 데이터 관리

### 4.1 가져오기/내보내기
- JSON 형식 컬렉션 파일
- Postman 컬렉션 가져오기 지원
- OpenAPI(Swagger) 스펙 가져오기

### 4.2 자동 백업
- 브라우저 localStorage 활용
- 선택적 클라우드 동기화 (향후)

---

## 5. 구현 우선순위

### Phase 1: UI 개선 (필수)
1. 2단 레이아웃 (사이드바 + 메인)
2. CSS 변수 시스템 적용
3. 메서드별 색상 코드
4. 통계 대시보드

### Phase 2: 핵심 기능 (중요)
1. 테스트 컬렉션 관리
2. 환경 변수 시스템
3. 다중 계정 관리
4. 응답 데이터 체이닝

### Phase 3: 고급 기능 (선택)
1. 웹소켓 테스트
2. 코드 스니펫 생성
3. 검증 강화
4. Postman 가져오기

---

## 6. 파일 구조 제안

```
api-tester/
├── index.html          # 메인 HTML
├── styles/
│   ├── variables.css   # CSS 변수
│   ├── layout.css      # 레이아웃
│   ├── components.css  # 컴포넌트
│   └── theme.css       # 테마
├── js/
│   ├── app.js          # 메인 앱
│   ├── api.js          # API 호출
│   ├── storage.js      # 저장소
│   ├── collection.js   # 컬렉션 관리
│   ├── auth.js         # 인증 관리
│   └── ui.js           # UI 렌더링
└── assets/
    └── fonts/          # 폰트 파일
```

---

## 7. 기술 스택

- **Vanilla JavaScript** (프레임워크 없이)
- **CSS Variables** (테마 시스템)
- **localStorage** (데이터 저장)
- **Web Fonts** (JetBrains Mono)

---

## 참고

이 문서는 index.html과 index2.html을 분석하여 작성되었습니다.
index2.html의 장점(세련된 UI, 다중 계정, 시나리오 실행)과
index.html의 범용성(특정 API에 종속되지 않음)을 결합한 업그레이드 방향입니다.
