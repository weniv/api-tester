# API 테스터

API 명세서 작성 및 부트캠프 프로젝트 문서 작성용 내부 도구

## 사용법

https://weniv.github.io/api-tester/ 링크에서 바로 사용 가능

## 주요 기능

-   **단일 API 테스트 실행** - Base URL + Endpoint + Method + Body 입력 후 실행
-   **Request/Response 기록** - Headers, Body 모두 저장
-   **히스토리 자동 저장** - Base URL > 테스트명 기준으로 로컬스토리지에 저장
-   **테스트명 자동 추천** - 동일 Endpoint 재실행 시 이전 테스트명 자동 입력
-   **Expected Response 검증** - 응답 필드 값 일치 여부 확인

## Expected Response 사용법

| 입력                | 동작                         |
| ------------------- | ---------------------------- |
| `{"success": true}` | success 필드가 true인지 검증 |
| `{"userId": null}`  | userId 필드 존재 여부만 검증 |
| 비워두기            | 상태 코드만 검증             |

## 데이터 저장

-   브라우저 로컬스토리지 사용
-   설정값, 히스토리 자동 저장
-   브라우저/기기별로 별도 저장
