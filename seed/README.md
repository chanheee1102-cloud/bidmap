# seed

`bidmap.sqlite.gz` — 서버가 처음 뜰 때 영구 볼륨에 푸는 DB(4년치 수집분). 조달청 API 하루 한도 때문에
처음부터 다시 받으면 이틀쯤 걸려서 둔다. 용량과 공개 범위 때문에 git에는 올리지 않는다.

다시 만들기: 프로젝트 루트에서 `python -m bidmap snapshot`
