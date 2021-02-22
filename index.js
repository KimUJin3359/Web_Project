const express = require("express");
const app = express();
const PORT = 8080;
const multer = require("multer");
const cookieParser = require("cookie-parser");
const db = require("./models/index");
const path = require("path");
const { hashPassword, comparePassword } = require("./utils/bcrypt");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.set("view engine", "ejs");

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
}
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

app.use(authentication);

app.get("/", (req, res) => {
    return res.render("index");
});

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

app.get("/create", (req, res) => {
    return res.render("create");
})

app.get("/login", (req, res) => {
    return res.render("login");
});

app.get("/signup", (req, res) => {
    return res.render("signup");
});

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

app.get("/logout", (req, res) => {
    res.clearCookie("loginId");
    res.locals.user = null;
    return res.redirect("/");
});

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

app.get("/download/:id", async (req, res) => {
    try {
        const fileData = await db["file"].findOne({
            where: {
                id: req.params.id
            }
        });
        const { filename, originalname } = fileData.dataValues;
        return res.download(`./uploads/${filename}`, originalname);
    } catch (error) {

    }
})
app.use(express.static('./static'))
app.listen(PORT, () => console.log(`this server listening on ${PORT}`));
