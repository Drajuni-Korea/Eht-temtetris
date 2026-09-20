# EHT 템트리스 서버 OCR

모바일에서 사진 업로드가 끝난 뒤 OCR은 Node 서버에서 계속 처리됩니다.

## Railway

1. Railway에서 **New Project**
2. **Deploy from GitHub repo**
3. `Drajuni-Korea/Eht-temtetris` 선택
4. 배포 후 **Generate Domain**
5. 발급된 주소로 접속

Railway가 `package.json`의 `npm start`를 자동 실행합니다.

## 영구 저장

OCR 작업 파일을 재배포 이후에도 유지하려면 Railway Volume을 연결하고 환경변수:

```
DATA_DIR=/data
```

를 설정하세요.

장비 목록 자체는 브라우저 IndexedDB에 저장됩니다.
