# 퍼블릭 배포 가이드

## Vercel을 통한 고정식 퍼블릭 링크 배포

### 1. Vercel 계정 준비

1. **Vercel 회원가입**
   - [vercel.com](https://vercel.com) 방문
   - GitHub 계정으로 로그인 권장

2. **GitHub 저장소 연결**
   - 현재 프로젝트를 GitHub에 업로드
   - Vercel에서 해당 저장소 import

### 2. 배포 설정

1. **환경변수 설정**
   - Vercel 대시보드에서 프로젝트 설정
   - Environment Variables에 다음 추가:
     ```
     REACT_APP_OPENAI_API_KEY=your_api_key_here
     ```

2. **자동 배포**
   - GitHub push 시 자동 배포됨
   - 배포 URL: `https://your-project-name.vercel.app`

### 3. 빠른 배포 방법

**Vercel CLI 사용:**

```bash
# Vercel CLI 설치
npm i -g vercel

# 로그인
vercel login

# 배포
vercel

# 프로덕션 배포
vercel --prod
```

### 4. 배포 후 접근

**퍼블릭 URL:**
- `https://zendesk-ticket-analyzer.vercel.app` (예시)
- 전 세계 어디서든 접근 가능
- HTTPS 자동 적용
- 고정 URL (변경되지 않음)

### 5. 대안 배포 서비스

**Netlify:**
1. [netlify.com](https://netlify.com) 방문
2. GitHub 저장소 연결
3. 빌드 명령: `npm run build`
4. 배포 폴더: `build`

**GitHub Pages:**
1. `npm install --save-dev gh-pages` 설치
2. package.json에 homepage 추가:
   ```json
   "homepage": "https://username.github.io/repository-name"
   ```
3. 배포 스크립트 추가:
   ```json
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d build"
   }
   ```
4. `npm run deploy` 실행

### 6. 주의사항

**보안:**
- API 키는 환경변수로 관리
- 민감한 정보는 코드에 하드코딩 금지

**성능:**
- 빌드 최적화 완료
- Gzip 압축 적용
- CDN을 통한 빠른 로딩

**사용법:**
- 배포된 링크를 누구나 접근 가능
- 모바일/데스크톱 모두 지원
- 실시간 GPT 분석 기능 포함

### 7. 배포 상태 확인

배포 완료 후 다음 기능들이 정상 작동하는지 확인:

- ✅ JSON 파일 업로드
- ✅ 티켓 검색 및 필터링
- ✅ GPT 분석 기능
- ✅ CSV 다운로드
- ✅ 반응형 UI (모바일/데스크톱)
- ✅ 개선된 표 형태 UI

### 8. 문제 해결

**배포 실패 시:**
- 빌드 로그 확인
- 환경변수 설정 재확인
- Node.js 버전 호환성 확인

**API 오류 시:**
- OpenAI API 키 유효성 확인
- 사용량 한도 확인
- 네트워크 연결 상태 확인 