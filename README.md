# Web_Project
- 로그인 기능을 포함한 게시판 사이트 생성
- 로그인에 따른 토큰 및 관련 보안(비밀번호 암호화 및 만료기간 생성 등) 실습
- 웹 사이트에 DB연동 실습
- 사이트에서 저장된 파일을 받아오는 실습

#### 사용한 모듈
- bcrypt
- cookie-parser
- ejs
- express
- multer
- mysql2
- nodemon
- sequelize
- sequelize-cli
- 'npm i' 명령어 사용 시, 자동으로 패키지 구성

### index.js
- authentication
  - cookie에 loginId가 있을 시, 사용자의 정보를 받아옴(user 전역변수에 저장)
  - 그 외, 현재 사용자가 없음을 표시
  ```
  const authentication = async (req, res, next) => {
    console.log(req.cookies["loginId"]);
    if (req.cookies["loginId"]) {
        try {
            const userInformation = await db["user"].findOne({
                where: {
                    id: req.cookies["loginId"],
                },
            });
            res.locals.user = userInformation.dataValues;
        } catch (error) {
            res.locals.user = null;
        }
    }
    next();
  };
  ```
- multer
  - file을 uploads 폴더에 저장
  - 파일의 이름은 기존의 이름 + 현재의 날짜/시간을 더한 값
  ```
  const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, done) => {
            done(null, "uploads/");
        },
        filename: (req, file, done) => {
            const ext = path.extname(file.originalname);
            done(null, path.basename(file.originalname, ext) + Date.now() + ext);
        },
    })
  });
  ```

### index.js의 CRUD
- /(GET)
  - 루트 페이지
- /board(GET)
  - 게시판 페이지
  - board(게시판)에 있는 모든 정보들을 id, name, file과 함꼐 받아와서 board에 넘겨줌
  ```
  app.get("/board", async (req, res) => {
    try {
        const data = await db["board"].findAll({
            include: [
                { model: db["user"], attributes: ["id", "name"] },
                { model: db["file"] },
            ],
        });
        const result = data.map(el => el.get({ plain: true }));
        return res.render("board", { board: result });
    } catch (error) {
        res.render("board");
    }
  });
  ```
- /create(GET)
  - 게시판을 생성하는 화면을 보여주는 페이지
- /login(GET)
  - 로그인을 하는 페이지
- /signup(GET)
  - 회원가입을 하는 화면을 보여주는 페이지
- /register(POST)
  - 이름, 취미, 나이, 이메일주소, 비밀번호를 signup페이지로부터 입력받아 계정을 생성하는 작업 수행
  - 비밀번호는 **암호화 작업**을 통해 넘겨줌
  ```
  app.post("/register", async (req, res) => {
    try {
        const { name, hobby, age, email, password } = req.body;
        const hashedPassword = await hashPassword(password);
        const data = await db["user"].create({
            name: name,
            hobby: hobby,
            age: age,
            email: email,
            password: hashedPassword,
        });
        return res.render("logic", { type: "register", result: true });
    } catch (error) {
        console.log(error);
        return res.render("logic", { type: "register", result: false });
    }
  });
  ```
- /login(POST)
  - DB로 부터 해당 email 주소에 해당하는 비밀번호를 받아와, 입력한 비밀번호와 비교
  - comparePassword 모듈을 사용해 비교 수행
  - 쿠키 도난 방지 및 웹 서버에서만 접근 가능하게 설정
  ```
  app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        //1차 DB 검색
        const data = await db["user"].findOne({
            where: {
                email: email,
            },
        })
        //암호화된 비밀번호와 DB에 있는 암호화된 비밀번호를 비교
        const hashedPassword = data.dataValues.password;
        const result = await comparePassword(password, hashedPassword);

        console.log("result :" + result);
        if (result === true) {
            res.cookie("loginId", data.dataValues.id, {
                //쿠키 도난 방지
                expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
                //웹서버에서만 쿠키 접근할 수 있게 default는 true
                httpOnly: true,
            })
            return res.render("logic", { type: "login", result: true });
        }
        return res.render("logic", { type: "login", result: false });
    } catch (error) {
        console.log(error);
        return res.render("logic", { type: "login", result: false });
    }
  });
  ```
- /logout(GET)
  - cookie를 초기화시켜, 로그아웃을 수행
- /post(POST)
  - 제목, 내용 및 파일을 create 페이지로부터 입력받아 DB에 삽입
  - title, content는 board table에 삽입
  - file은 file table에 삽입
  ```
  app.post("/post", upload.single("file"), async (req, res) => {
    try {
        const { title, content } = req.body;
        console.log("title : " + title);
        const post = await db["board"].create({
            title: title,
            content: content,
            user_id: res.locals.user.id,
        });
        const boardId = post.dataValues.id;
        if (req.file) {
            await db["file"].create({
                filename: req.file.filename,
                originalname: req.file.originalname,
                board_id: boardId,
            });
        }
        return res.render("logic", { type: "post", result: true });
    } catch (error) {
        return res.render("logic", { type: "post", result: false });
    }
  });
  ```
- /download/:id(GET)
  - 저장한 file을 다운로드 받는 작업 수행
  
### EJS
#### [board](https://github.com/KimUJin3359/Web_Project/blob/master/views/board.ejs)
- 로그인이 된 상태면 '글쓰기' 상태 창이 보임
  ![board](https://user-images.githubusercontent.com/50474972/108709961-bd63be80-7556-11eb-9046-2694f69ea48c.JPG)
#### [create](https://github.com/KimUJin3359/Web_Project/blob/master/views/create.ejs)
  ![create](https://user-images.githubusercontent.com/50474972/108709963-bdfc5500-7556-11eb-9f1f-b5f18c573baf.JPG)
#### [index](https://github.com/KimUJin3359/Web_Project/blob/master/views/index.ejs)
  ![index](https://user-images.githubusercontent.com/50474972/108709946-b9d03780-7556-11eb-95bc-21cd6f6c4581.JPG)
#### [login](https://github.com/KimUJin3359/Web_Project/blob/master/views/login.ejs)
  ![login](https://user-images.githubusercontent.com/50474972/108709956-bd63be80-7556-11eb-8f82-484a3baafbdc.JPG)
#### [signup](https://github.com/KimUJin3359/Web_Project/blob/master/views/signup.ejs)  
  ![signup](https://user-images.githubusercontent.com/50474972/108709952-bb016480-7556-11eb-8d11-26c261231cd9.JPG)
#### [logic](https://github.com/KimUJin3359/Web_Project/blob/master/views/logic.ejs)
- 회원가입 성공/실패에 따른 페이지
- 로그인 성공/실패에 따른 페이지
- 게시판 글 작성 성공/실패에 따른 페이지
#### [common](https://github.com/KimUJin3359/Web_Project/tree/master/views/common)
- bootstrap.ejs : bootstrap을 사용하기 위한 script
- header.ejs : 모든 페이지에 공통적으로 사용되는 nav-bar 존재

### util
- [bcrypt.js](https://github.com/KimUJin3359/Web_Project/blob/master/utils/bcrypt.js)
  - hashPassword : password를 hash화
  - comparePassword : 입력받은 패스워드와 hash화 된 패스워드 비교
  



