const parser = require("@babel/parser");
const traverse = require('@babel/traverse').default;
const generator = require("@babel/generator").default;
const fs = require("fs");
const t = require("@babel/types");

/*
    解substrate混淆

*/
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
    var mother_key = []
    let mother_key_map = get_mother_key(ast, mother_key)
    traverse(ast, {
        VariableDeclarator(path){
            try{
                if(mother_key.includes(path.node.init.name)){
                    mother_key_map[path.node.id.name] = mother_key_map[path.node.init.name]
                }
            }
            catch (e){

            }

        }
    });
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
    let decode = generator(ast).code
    // console.log(decode)
    // return decode
}


function cut(ast){
    let moudle_name = ''
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
                        debugger
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
            AssignmentExpression(path){
                try{
                    if(path.node.left.name==="reese84" && path.node.operator==="="){
                        moudle_name = path.node.right.name
                    }
                }catch (e){

                }
            }

        }
    )
    traverse(
        ast, {
            VariableDeclarator(path){
                try{
                    if(path.node.id.name === moudle_name && path.node.init.arguments[0].value===111){
                        //修改moudle
                        path.node.init.arguments[0].value = 432
                        let __name = path.node.init.callee.name
                        //添加time
                        let __time_node = t.assignmentExpression(
                            "=", // Assignment operator
                            t.memberExpression(
                                t.identifier("window"), // Object: window
                                t.identifier("__timer"), // Property: __timer
                                false // Not computed
                            ),
                            t.callExpression(
                                t.identifier(__name), // Callee: _0x318d19
                                [t.numericLiteral(496)] // Arguments: [496]
                            )
                        );
                        path.parentPath.parent.body.push(__time_node);
                    }
                }catch (e) {

                }
            }
        }
    )

}

// cut(ast)
/*
    step1: 裁切第一个只执行的函数，并修改其中的settimeout函数和addEventLis
*/

exports.cut = cut
exports.crack= crack