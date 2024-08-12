const parser = require("@babel/parser");
const traverse = require('@babel/traverse').default;
const generator = require("@babel/generator").default;
const fs = require("fs");
const t = require("@babel/types");
// let jsFile = fs.readFileSync("./raw.js","utf-8");
// ast = parser.parse(jsFile);
// let   decode_JS = generator(ast,{minified:true,jsescOption:{minified: true}}).code
// ast = parser.parse(decode_JS);//
const ivm = require('isolated-vm')
const isolate = new ivm.Isolate({ memoryLimit: 32 });

/*
    解substrate混淆

*/

function IsArrayAllStringLiteral(arr){
    let isAllString = true
    if(!arr.elements){
        return false
    }
    if(!Array.isArray(arr.elements.slice(0))){
        return false
    }
    if(arr.elements.length < 10){
        return  false
    }
    for(let i = 0; i < arr.elements.length ;i++){
        let _item = arr.elements[i]
        try{
            if(_item.type !== "StringLiteral"){
                return false
            }
        }catch{

        }
    }

    return isAllString

}
function IsBelongDecryptoFunc(_path){
    let startVar = _path.node.init.name
    let chains = [startVar]
    while(true){
        try{
            let c_node = _path.scope.getBinding(startVar)
            if( c_node.path.node.type === "VariableDeclarator"){
                startVar = c_node.path.node.init.name;
                chains.push(startVar)
            }else{
                break
            }
        }
        catch (e) {
            break
        }


    }
    return chains
}
function get_mother_key(ast, mother_key){
    let fragment_node = ast.program.body[0].expression.callee.body.body.slice(0,-2);
    let new_node_list = []

    for(let i=0; i<= fragment_node.length; i++){
        try {
            if(fragment_node[i].declarations[0].init.callee.property.name==="join"){
                let current_key = fragment_node[i].declarations[0].id.name;
                mother_key.push(current_key)
                // 创建一个push节点
                let __p = t.expressionStatement(
                    t.callExpression(
                        t.memberExpression(
                            t.identifier("Mom_Keys"),
                            t.identifier("push"),
                        ),
                        [t.identifier(current_key)],
                    ),
                );
                new_node_list.push(__p);
            }
        }catch (e){

        }
    }
    // 遍历插入新节点
    for(let i=0; i<new_node_list.length;i++){
        fragment_node.push(
            new_node_list[i]
        )
    }
    // 组装新的代码片段
    let new_code = 'function xx (){\n let Mom_Keys = [];\nwindow=globalThis;\n'
    for(let i=0; i<fragment_node.length;i++){
        let _statement = generator(fragment_node[i]).code
        new_code += _statement+'\n'
    }
    new_code += '\n return Mom_Keys\n};return xx();'
    let mother_list = new Function(new_code)()
    let mother_map = {}
    for(let i=0; i<mother_key.length; i++){
        mother_map[mother_key[i]] = mother_list[i]
    }
    return mother_map

}

function crack(ast){
    let ob_context = isolate.createContextSync()
    var mother_key = []
    let mother_key_map = get_mother_key(ast, mother_key)
    let ob_context_script = ''
    let ob_deob_func_name = []
    traverse(ast, {
        VariableDeclarator(path){
            try{
                if(mother_key.includes(path.node.init.name)){
                    mother_key_map[path.node.id.name] = mother_key_map[path.node.init.name]
                }
            }
            catch (e){

            }
            if(path.node.init
                && path.node.init.type === "ArrayExpression"
                && IsArrayAllStringLiteral( path.node.init)){
                let ob_args_func = path.getFunctionParent().node.id.name
                path.getFunctionParent().scope.getBinding(ob_args_func).referencePaths.forEach(
                    (nodePath2) => {
                        let _code = ''
                        if(nodePath2.listKey === "arguments"){
                            _code = `!${generator(nodePath2.parent).code}`

                        }else{
                            _code = generator(nodePath2.parentPath.getFunctionParent().node).code
                            if(_code.includes('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=')){
                                ob_deob_func_name.push(nodePath2.parentPath.getFunctionParent().node.id.name)
                            }

                        }
                        ob_context_script += _code
                        ob_context_script += '\n//#########\n'
                    }
                )


            }
        },
    });
    // 执行ob混淆的上下文脚本
    ob_context.evalSync(ob_context_script)
    traverse(ast, {
        VariableDeclarator(path){
            if(path.node.init){
                if(path.node.init.type === "Identifier"){
                    let __cs = IsBelongDecryptoFunc(path)
                    if(ob_deob_func_name.includes(__cs.slice(-1)[0])){
                        let _ia_name = path.node.id.name;

                        path.scope.getBinding(_ia_name).referencePaths.forEach(
                            (nodePath2) =>{
                                if(nodePath2.key ==="callee"){
                                    let _args0 = nodePath2.parent.arguments[0].value
                                    let newStr = ob_context.evalSync(`${ob_deob_func_name[0]}(${_args0})`)
                                    let newNode = t.StringLiteral(newStr)
                                    nodePath2.parentPath.replaceInline(newNode)
                                }else if(nodePath2.key === "init"){
                                    ob_deob_func_name.push(nodePath2.parent.id.name)
                                }
                            }
                        )
                    }
                }
            }
        }
    })
    traverse(ast, {
        CallExpression(path){
            try{
                if(path.node.callee.property){
                    if(path.node.callee.property.name === 'substr'){
                        let obj_name = path.node.callee.object.name
                        let args = path.node.arguments;
                        if(Object.keys(mother_key_map).includes(obj_name)){
                            path.replaceInline(t.StringLiteral(mother_key_map[obj_name].substr(args[0].value, args[1].value)))
                        };


                    }
                }

            }
            catch (e){

            }

        }
    });

    traverse(ast, {
        BinaryExpression(path){
            try{
                if(path.node.operator === '+'){
                    if(path.node.right.type ==="StringLiteral" &&  path.node.left.type ==="StringLiteral"){
                        let left =  path.node.left.value;
                        let right =  path.node.right.value;
                        let result = left + right;
                        let new_node = t.StringLiteral(result)
                        path.replaceInline(new_node);
                    }
                }
            }
            catch (e){

            }

        }
    });
    traverse(ast, {
        BinaryExpression(path){
            try{
                if(path.node.operator === '+'){
                    if(path.node.right.type ==="StringLiteral" &&  path.node.left.type ==="StringLiteral"){
                        let left =  path.node.left.value;
                        let right =  path.node.right.value;
                        let result = left + right;
                        let new_node = t.StringLiteral(result)
                        path.replaceInline(new_node);
                    }
                }
            }
            catch (e){

            }

        }
    });

    // let decode = generator(ast).code
    // console.log(decode)
    // return decode
}


function cut(ast){
    let moudle_map = {}
    traverse(
        ast,{
            CallExpression(path){
                try{
                    if (
                        path.node.callee.property.value==="addEventListener" && path.node.arguments[0].value==="load"
                    ){
                        let call_func_node = path.node.arguments[1]
                        call_func_node.arguments = []
                        path.replaceInline(t.UnaryExpression("!", t.callExpression(call_func_node,[])))

                    }
                    /*删掉settimeout*/
                    if(path.node.callee.property.value==="setTimeout" && path.node.arguments[1].value===0 && path.node.arguments[0].name!== undefined){
                        let n = t.callExpression(
                            t.identifier(path.node.arguments[0].name), // 函数名
                            [] // 参数列表，这里为空
                        );
                        path.replaceInline(n)
                    };
                    // 添加返回值
                    if(path.node.callee.property.value==="createElement" && path.node.arguments[0].value==="IFRAME"){
                        let __token_node = t.variableDeclaration("let", [
                            t.variableDeclarator(
                                t.identifier("__token"),
                                t.arrayExpression([])
                            )
                        ]);
                        let __return_node = t.returnStatement(
                            t.memberExpression(
                                t.identifier("__token"),
                                t.numericLiteral(0),
                                true // Computed property access
                            )
                        );
                        path.parentPath.parentPath.parent.body.unshift(__token_node);
                        path.parentPath.parentPath.parent.body.push(__return_node);

                    }
                    // 收集返回值
                    if(path.node.callee.property.value==="stop" && path.node.arguments[0].value==="interrogation"){
                        // debugger
                        let last_node = path.parentPath.parent.body.slice(-1)[0]
                        let token_vname = last_node.expression.arguments[0].name
                        let append_node = t.expressionStatement(
                            t.callExpression(
                                t.memberExpression(
                                    t.identifier("__token"),
                                    t.identifier("push"),
                                    false // Not computed
                                ),
                                [t.identifier(token_vname)] // Argument: XJU
                            )
                        );
                        path.parentPath.parent.body.splice(-1,1, append_node)

                    }
                }catch (e){

                }
            },
            ObjectProperty(path){
                if(path.node.key
                    && path.node.key.type === "NumericLiteral"
                    && path.node.value.type === 'FunctionExpression'
                ){
                    let _code = generator(path.node.value).code
                    if(_code.includes('window["reese84interrogato"')){
                        moudle_map["interrogatorFactory"] = path.node.key.value;
                    }else if(_code.includes('["timerFactory"] = function ()')){
                        moudle_map["timerFactory"] = path.node.key.value;
                    }else if(_code.includes('"hash": function')){
                        moudle_map["hashFactory"] = path.node.key.value;
                    }
                }
                if(path.node.key
                    && path.node.key.type === "StringLiteral"
                    && path.node.key.value === "aih"
                    && path.node.value.type === 'StringLiteral'
                ){
                    moudle_map["aih"] = path.node.value.value
                }
            }

        }
    )
    traverse(
        ast, {
            AssignmentExpression(path){
                try{
                    if(path.node.left.name === "reese84"){
                        //修改moudle
                        // if(path.node.init !== null){
                            let reese_org = path.node.right.name;
                            let moudle_name = path.scope.getBinding(reese_org).path.node.init.callee.name;
                            path.scope.getBinding(reese_org).path.node.init.arguments[0].value = moudle_map['interrogatorFactory'];
                            //添加time
                            let __time_node = t.assignmentExpression(
                                "=", // Assignment operator
                                t.memberExpression(
                                    t.identifier("window"), // Object: window
                                    t.identifier("__timer"), // Property: __timer
                                    false // Not computed
                                ),
                                t.callExpression(
                                    t.identifier(moudle_name), // Callee: _0x318d19
                                    [t.numericLiteral(moudle_map["timerFactory"])] // Arguments: [496]
                                )
                            );
                            //添加hash
                            let __hash_node = t.assignmentExpression(
                                "=", // Assignment operator
                                t.memberExpression(
                                    t.identifier("window"), // Object: window
                                    t.identifier("__hash"), // Property: __timer
                                    false // Not computed
                                ),
                                t.callExpression(
                                    t.identifier(moudle_name), // Callee: _0x318d19
                                    [t.numericLiteral(moudle_map["hashFactory"])] // Arguments: [496]
                                )
                            );
                            let aih_node = t.assignmentExpression(
                                "=", // Assignment operator
                                t.memberExpression(
                                    t.identifier("window"), // Object: window
                                    t.identifier("__aih"), // Property: __timer
                                    false // Not computed
                                ),
                                t.StringLiteral(
                                    moudle_map['aih']
                                )
                            );
                            path.parentPath.parent.body.push(__time_node);
                            path.parentPath.parent.body.push(__hash_node);
                            path.parentPath.parent.body.push(aih_node);
                        }


                    // }
                }catch (e) {

                }
            }
        }
    )

}

// crack(ast)
// cut(ast)

/*
    step1: 裁切第一个只执行的函数，并修改其中的settimeout函数和addEventLis
*/

exports.cut = cut
exports.crack= crack