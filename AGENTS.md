fushion폴더 내부파일만 참고해. main.py는 백엔드 코드이고 나머지는 전부 frontend코드야. 
Chatgpt처럼 챗봇형식으롣 대화하는 웹사이트를 제작해야되.

필요한 기능 정리
1. 로그인기능, 사용자가 로그인화면 사용자id가 좌측상단에 표기, 로그인key는 open-sesame으로 통일
2. 로그인시 사용자별로 thread_id로 구분되는 채팅방을 생성가능하도록 하고, 서버가 꺼져서 접속하더라도 기록이 남도록 하기
3. 채팅은 이미지와 텍스트가 가능하며, 이미지를 업로드하면 채팅창플로팅 안애 작게 표기되고, enter를 누르면 화면에 표기되도록 하기
4. 응답은 streaming으로 받아오기. (실시간으로 한글자식 출력되도록)
5. 우클릭으로 채팅방 이름 수정 가능하도록 하기.
반드시 유저가 채팅을 입력했을때 streaming하게 실시간으로 출력이 한글자씩 되야되.

