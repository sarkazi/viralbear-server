const multer = require('multer')
const storage = multer.diskStorage({
    destination(req,file,cb){
cb(null,'files/')
    },
    filename(req,file,cb){
        cb(null, Math.random()+'-'+file.originalname)
    }
})

const fileFilter=(req,file,cb)=>{
    
        cb(null,true)
     
}
module.exports=multer({storage:storage})