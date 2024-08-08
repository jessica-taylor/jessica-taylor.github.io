;;Reversible programming language, by Jessica Taylor
;;Scroll to the bottom to see examples/demos.


;Syntax:

;(procedure arg1 arg2...)
;Calls procedure with lvalues arg1, arg2, ...
;Any arg should either be a variable or a quoted expression.  If the argument is
;quoted, the quoted expression will be evaluated and stored in a temporary
;variable.  So, (add '1 x) is like having (local y) (copy '1 y) (add y x) (clear 'y)

;(begin (local x ...) ...)
;Executes multiple statements using local variables, initially uninitialized.
;There is an implicit begin around the body of a defproc or undo.

;(undo ...)
;Undoes the statements in the body.  If, before the undo statement, the program
;is in state s, and, if the program had been in state t before executing the
;body of the undo, it would then be in state s, then the resulting state of the
;program is t.  Any statement x followed by (undo x) will either cause an error
;or do nothing.

;(if cond then else end-cond)
;Executes "then" statement if cond (a lisp expression) is true, or "else"
;otherwise.  end-cond, evaluated after the if, must have the same truth-value
;as cond, evaluated before the if.
;(while cond body end-cond)
;While cond is true, execute body.  Checks to make sure that end-cond is false
;before entering the loop and true after every iteration


;Undo process:
;(undo (undo x)) = x
;(undo (begin x y)) = (begin (undo y) (undo x))
;(undo (if cond then else end-cond)) = (if end-cond (undo then) (undo else) cond)  
;(undo (while cond body end-cond) = (while end-cond (undo body) cond)
;All procedure calls can be undone: for example, (undo (add x y)) = (subtract x y)
;This allows any statement to be undone.


;An lvalue stores a value.  It can either be set or unset.
(defstruct lvalue
  (is-set nil) 
  (value nil))

;alias for lvalue-value, for use in reversible code
(defun get-value (lvalue)
  (lvalue-value lvalue))

(defun make-lvalue-with (value)
  (make-lvalue :is-set t :value value))

;Binds variables to lvalues.
;Example:
;(with-lvalues ((x 5) y)
;    do stuff with x (lvalue initialized to 5) and y (uninitialized lvalue)
;   )
(defmacro with-lvalues (binds &body body)
  `(let ,(mapcar (lambda (bind)
                   (if (consp bind)
                       `(,(car bind) (make-lvalue-with ,(second bind)))
                       `(,bind (make-lvalue))))
                 binds)
     ,@body))

;Ensures that an lvalue is uninitialized, then initializes in to a value.
(defun init-lvalue (lvalue init)
  (assert (not (lvalue-is-set lvalue)) nil
     "Cannot initialize lvalue that is already initialized.")
  (setf (lvalue-value lvalue) init
        (lvalue-is-set lvalue) t))

;Uninitializes an lvalue.
(defun clear-lvalue (lvalue)
  (setf (lvalue-value lvalue) nil
        (lvalue-is-set lvalue) nil))

;A procedure takes lvalue arguments and can be run forwards or backwards
;(call or uncall)
(defstruct proc
  call uncall)

;Apply a procedure to lvalue arguments.  Undoes it if is-undo is set.
(defun call-proc-helper (proc is-undo &rest args)
  (when (symbolp proc)
    (let ((proc-value (gethash proc *current-namespace*)))
      (assert proc-value nil
        "Invalid procedure name: ~a" nil proc)
      (setf proc proc-value)))
  (apply (if is-undo (proc-uncall proc) (proc-call proc)) args))

(defun call-proc (proc &rest args)
  (apply #'call-proc-helper proc nil args))

(defun uncall-proc (proc &rest args)
  (apply #'call-proc-helper proc t args))

;Create the inverse of a procedure.
(defun reverse-proc (proc)
  (make-proc :call (proc-uncall proc)
             :uncall (proc-call proc)))


;Given fun, returns a function appropriate for the call field of a proc.
;The function takes src and dest, setting dest to f(dest, src).
;For example, given -, it implements the call field of the subtract procedure.
(defun function-proc-call (fun)
  (lambda (src dest)
    (assert (lvalue-is-set src) nil "Cannot apply function to null value.")
    (assert (lvalue-is-set dest) nil "Cannot apply function using null value.")
    (setf (lvalue-value dest)
          (funcall fun (lvalue-value dest) (lvalue-value src)))))
             
;(src dest) -> copies value of src into dest
(defparameter p-copy
  (make-proc
   :call
   (lambda (src dest)
     (assert (lvalue-is-set src) nil "Cannot copy from nothing.")
     (assert (not (lvalue-is-set dest)) nil 
             "Cannot copy to initialized value ~a." dest)
     (init-lvalue dest (lvalue-value src)))
   :uncall
   (lambda (src dest)
     (assert (lvalue-is-set src) nil "Cannot clear using uninialized value.")
     (assert (lvalue-is-set dest) nil "Cannot clear uninitialized value")
     (assert (equal (lvalue-value src) (lvalue-value dest)) nil
             "Cannot clear variable with value ~a using unequal value ~a."
             (lvalue-value dest) (lvalue-value src))
     (clear-lvalue dest))))

(defparameter p-clear (reverse-proc p-copy))
     

;(src dest) -> dest += src
(defparameter p-add
  (make-proc
   :call (function-proc-call #'+)
   :uncall (function-proc-call #'-)))

(defparameter p-subtract (reverse-proc p-add))

;(src dest) -> dest *= src
(defparameter p-multiply
  (make-proc
   :call (function-proc-call
          (lambda (x y)
           (assert (not (= y 0)) nil "Can't multiply by 0.")
           (* x y)))
   :uncall (function-proc-call
            (lambda (x y)
             (assert (not (= y 0)) nil "Can't divide by 0.")
             (/ x y)))))

(defparameter p-divide (reverse-proc p-multiply))

;(x y q r) -> q = floor(x / y), r = x % y, x cleared
(defparameter p-divmod
  (make-proc
   :call
   (lambda (x y q r)
     (assert (and (lvalue-is-set x) (lvalue-is-set y)) nil
             "Can't divmod uninitialized value.")
     (assert (/= (lvalue-value y) 0) nil "Can't divmod by 0.")
     (assert (and (not (lvalue-is-set q)) (not (lvalue-is-set r))) nil
             "Can't divmod to initialized value.")
     (assert (not (lvalue-is-set r)) nil "Can't divmod to initialized value.")
     (multiple-value-bind (quotient rem) 
         (floor (lvalue-value x) (lvalue-value y))
       (init-lvalue q quotient)
       (init-lvalue r rem)
       (clear-lvalue x)))
   :uncall
   (lambda (x y q r)
     (assert (not (lvalue-is-set x)) nil "Can't un-divmod to initialized value.")
     (assert (lvalue-is-set y) nil "Can't un-divmod using uninitialized value.")
     (assert (and (lvalue-is-set q) (lvalue-is-set r)) nil
             "Can't un-divmod from uninitialized value.")
     (assert (and (>= (lvalue-value r) 0) (< (lvalue-value r) (lvalue-value y)))
             nil "Remainder out of range.")
     (init-lvalue x (+ (lvalue-value r) (* (lvalue-value q) (lvalue-value y))))
     (clear-lvalue q)
     (clear-lvalue r))))
     
             

;(src dest) -> dest = (cons src dest), src cleared
(defparameter p-push
  (make-proc
   :call
   (lambda (elem lst)
     (assert (lvalue-is-set elem) nil "Can't push uninitialized value.")
     (assert (lvalue-is-set lst) nil "Can't push to uninitialized list.")
     (push (lvalue-value elem) (lvalue-value lst))
     (clear-lvalue elem))
   :uncall
   (lambda (elem lst)
     (assert (not (lvalue-is-set elem)) nil "Can't pop to initialized value.")
     (assert (lvalue-is-set lst) nil "Can't pop from uninitialized value.")
     (init-lvalue elem (pop (lvalue-value lst))))))

(defparameter p-pop (reverse-proc p-push))

;Gets a printable value to represent an lvalue, which might be undefined.
(defun lvalue-printable (lvalue)
  (if (lvalue-is-set lvalue)
      (lvalue-value lvalue)
      "<undefined>"))

;(x y ...) -> prints out arguments for debugging purposes
(defparameter p-debug
  (make-proc
   :call
   (lambda (&rest args)
     (format t "Debug: ~{~a~^ ~}~%" (mapcar #'lvalue-printable args)))
   :uncall
   (lambda (&rest args)
     (format t "Debug (reversed): ~{~a~^ ~}~%" 
             (mapcar #'lvalue-printable args)))))

;From http://aima.cs.berkeley.edu/lisp/utilities/utilities.lisp
;Copies a hash table
(defun copy-hash-table (H1 &optional (copy-fn #'identity))
  (let ((H2 (make-hash-table :test #'equal)))
    (maphash #'(lambda (key val) (setf (gethash key H2) (funcall copy-fn val)))
	     H1)
    H2))
        
(defparameter builtin-procedure-list
  (list
   (cons 'copy p-copy)
   (cons 'clear p-clear)
   (cons 'add p-add)
   (cons 'subtract p-subtract)
   (cons 'multiply p-multiply)
   (cons 'divide p-divide)
   (cons 'divmod p-divmod)
   (cons 'push p-push)
   (cons 'pop p-pop)
   (cons 'debug p-debug)
))

(defparameter builtin-procedures (make-hash-table))

(dolist (builtin builtin-procedure-list)
  (setf (gethash (car builtin) builtin-procedures) (cdr builtin)))

(defparameter *current-namespace* (copy-hash-table builtin-procedures))

;Given arguments in a reversible procedure call, translates them to arguments
;suitable for call.  A quote before an argument causes the argument to be a
;temporary initialized using the quoted expression.  For example '1 turns into
;a temporary lvalue that holds 1.
(defun translate-arguments (args)
  (let* (temps
         (trans-args (mapcar (lambda (arg)
                               (if (and (consp arg) (eq (car arg) 'quote))
                                   (let ((sym (gensym "quoted-temp")))
                                     (push (cons sym (second arg)) temps)
                                     sym)
                                   arg))
                             args)))
    (values temps trans-args)))

;Translates a reversible procedure call to Lisp.
(defun translate-call (proc-name args &optional is-undo)
  (multiple-value-bind (temps trans-args) (translate-arguments args)
    (let ((temp-binds (mapcar (lambda (temp)
                                `(,(car temp) (make-lvalue-with ,(cdr temp))))
                              temps))
          (temp-checks (mapcar (lambda (temp)
                                 `(assert (and (lvalue-is-set ,(car temp))
                                               (equal (lvalue-value ,(car temp)) ,(cdr temp)))
                                          nil "Temp check failed: temp should equal ~a" ',(cdr temp)))
                               temps)))
      `(let ,temp-binds
         (,(if is-undo 'uncall-proc 'call-proc) ',proc-name ,@trans-args)
         ,@temp-checks))))

;Separate a begin body into locals and statements that make up the body.
(defun separate-begin (body)
  (when body
    (let ((first-stmt (first body))
          locals)
      (when (eq (car first-stmt) 'local)
        (setf locals (cdr first-stmt))
        (setf body (cdr body)))
      (values locals body))))
  
;Translates begin statement given locals and body.
(defun translate-begin-with (locals body)
  (let ((local-unsets (mapcar (lambda (local) 
                                `(assert (not (lvalue-is-set ,local)) nil
                                         "Local ~a is still set when it goes out of scope." ',local))
                              locals)))
    (cons 'let
          (cons (mapcar (lambda (local)
                          (list local '(make-lvalue)))
                        locals)
                (append body local-unsets)))))
  

(defun translate-begin (body &optional is-undo)
  (multiple-value-bind (locals body) (separate-begin body)
    (let ((trans-body (mapcar (lambda (stmt) (translate-statement stmt is-undo))
                              body)))
      (translate-begin-with locals 
                            (if is-undo (reverse trans-body) trans-body)))))

(defun separate-if (body)
  (case (length body)
    (2 (values (first body) (second body) '(begin) (first body)))
    (3 (values (first body) (second body) (third body) (first body)))
    (4 (values (first body) (second body) (third body) (fourth body)))
    (otherwise (error "Bad number of arguments to if (2-4 expected)"))))

(defun translate-if-with (condition then else end-condition)
  `(if ,condition
       (progn ,then (assert ,end-condition nil "If check failed: end condition ~a is false when begin condition ~a is true." ',end-condition ',condition))
       (progn ,else (assert (not ,end-condition) nil "If check failed: end condition ~a is true when begin condition ~a is false." ',end-condition ',condition))))
     
(defun translate-if (body &optional is-undo)
  (multiple-value-bind (condition then else end-condition) (separate-if body)
      (translate-if-with (if is-undo end-condition condition)
                         (translate-statement then is-undo)
                         (translate-statement else is-undo) 
                         (if is-undo condition end-condition))))

(defun separate-while (body)
  (case (length body)
    (2 (values (first body) (second body) (first body)))
    (3 (values (first body) (second body) (third body)))
    (otherwise (error "Bad number of arguments to while (2-3 expected)"))))

(defun translate-while-with (condition body end-condition)
  `(progn
     (assert (not ,end-condition) nil 
             "While check failed: end condition ~a is true before the loop.~%"
             ',end-condition)
     (loop while ,condition
        do (progn ,body 
                  (assert ,end-condition nil "While check failed: end condition ~a is false at the end of an iteration ." ',end-condition ',condition)))))

(defun translate-while (rest &optional is-undo)
  (multiple-value-bind (condition body end-condition) (separate-while rest)
    (translate-while-with (if is-undo end-condition condition)
                          (translate-statement body is-undo)
                          (if is-undo condition end-condition))))

  
(defun translate-undo (body &optional is-undo)
  (translate-statement (cons 'begin body) (not is-undo)))


(defun translate-init (body &optional is-undo)
  (if is-undo
      `(clear-lvalue-with-value ,(first body) (lambda () ,(second body)))
      `(init-lvalue ,(first body) (lambda () ,(second body)))))
  
  
;Translates a reversible statement to lisp.  If is-undo is set, the translation
;will undo the statement instead of doing it.
(defun translate-statement (stmt &optional is-undo)
  (case (car stmt)
    (begin (translate-begin (cdr stmt) is-undo))
    (if (translate-if (cdr stmt) is-undo))
    (while (translate-while (cdr stmt) is-undo))
    (undo (translate-undo (cdr stmt) is-undo))
    (otherwise (translate-call (car stmt) (cdr stmt) is-undo))))
       
;A macro for making anonymous procedures, similar to lambda
(defmacro proc (args &body body)
  (let ((stmt `(begin ,@body)))
    `(make-proc :call (lambda ,args ,(translate-statement stmt))
                :uncall (lambda ,args ,(translate-statement stmt t)))))

;Defines a procedure in the current namespace.
(defmacro defproc (name args &body body)
  `(setf (gethash ',name *current-namespace*) (proc ,args ,@body)))

;Perform a series of reversible statements.
(defmacro do-reversible (&body body)
  (translate-statement `(begin ,@body)))

;Initializes y to x's value and clears x.
(defproc move (x y)
  (copy x y)
  (clear y x))

;Computes 2^x, or alternatively log base 2 of y for y being a power of 2.
(defproc pow2 (x pow)
  (copy '1 pow)
  (while (> (get-value x) 0)
    (begin
     (multiply '2 pow)
     (subtract '1 x))
    (/= (get-value pow) 1))
  (clear '0 x))



;Reverses a list.    
(defproc reverse (lst rev)
  (copy 'nil rev)
  (while (get-value lst)
    (begin
     (local first)
     (pop first lst)
     (push first rev))
    (get-value rev))
  (clear 'nil lst))
     
;Converts an int to a list of digits, or a list of digits to an int.
(defproc int-to-string (int str)
  (copy 'nil str)
  (while (/= (get-value int) 0)
    (begin
     (local digit rest)
     (divmod int '10 rest digit)
     (push digit str)
     (move rest int))
    (not (null (get-value str))))
  (clear '0 int))

;Counts how many times elem appears at the beginning of lst, storing this count
;in num, and moving lst past all these elements.  Reversed, it puts elem at
;the beginning of the list num times.
(defproc count-elem (elem lst num)
  (copy '0 num)
  (while (and (get-value lst) (equal (get-value elem) (car (get-value lst))))
    (begin
     (local temp)
     (pop temp lst)
     (clear elem temp)
     (add '1 num))
    (/= (get-value num) 0)))

;Performs run length encoding.  E.g. (a a a b b) -> (3 a 2 b)
(defproc rle (data encoded)
  (local encoded-rev)
  (copy 'nil encoded-rev)
  (while (get-value data)
    (begin
     (local elem count)
     (pop elem data)
     (count-elem elem data count)
     (add '1 count)
     (push count encoded-rev)
     (push elem encoded-rev))
    (get-value encoded-rev))
  (clear 'nil data)
  (reverse encoded-rev encoded))

(defproc reverse-to (l1 l2)
  (while (get-value l1)
    (begin
     (local top)
     (pop top l1)
     (push top l2))
    (not (member (car (get-value l2)) '([ _))))
  (clear 'nil l1))


(defproc print-tree-helper (tr out)
  (if (numberp (get-value tr))
      (begin
       (local str)
       (int-to-string tr str)
       (reverse-to str out))
      (begin
       (local e)
       (copy ''[ e)
       (push e out)
       (while (get-value tr)
         (begin
          (local elem)
          (pop elem tr)
          (if (not (eq '[ (car (get-value out))))
              (begin
               (copy ''_ e)
               (push e out)))
          (print-tree-helper elem out))
         (not (eq '[ (car (get-value out)))))
       (clear 'nil tr)
       (copy ''] e)
       (push e out))
      (not (eq '] (car (get-value out))))))

(defproc print-tree (tr out)
  (local rev)
  (copy 'nil rev)
  (print-tree-helper tr rev)
  (reverse rev out))
         
         
       

       
       
(defun test-pow2 ()
  (let ((a 5) (b 64))
    (with-lvalues ((x a) y)
      (do-reversible (pow2 x y))
      (format t "2^~d = ~d~%" a (lvalue-value y)))
    (with-lvalues (x (y b))
      (do-reversible (undo (pow2 x y)))
      (format t "~d = 2^~d~%" b (lvalue-value x)))))

(defun test-int-string ()
  (let ((a 15241) (b '(1 3 4 2 5)))
    (with-lvalues ((x a) y)
      (do-reversible (int-to-string x y))
      (format t "~d as a string is ~a~%" a (lvalue-value y)))
    (with-lvalues (x (y b))
      (do-reversible (undo (int-to-string x y)))
      (format t "~a as an integer is ~d~%" b (lvalue-value x)))))

(defun test-rle ()
  (let ((a '(a a a b b c b a a a a)) (b '(1 a 4 b 2 a 1 c)))
    (with-lvalues ((x a) y)
      (do-reversible (rle x y))
      (format t "run length encoding of ~a is ~a~%" a (lvalue-value y)))
    (with-lvalues (x (y b))
      (do-reversible (undo (rle x y)))
      (format t "run length decoding of ~a is ~a~%" b (lvalue-value x)))))
  
(defun test-print-tree ()
  (let ((a '(1 (2) 3)) (b '( [ 2 3 _ [ 1 2 ] _ 4 _ 5 ] )))
    (with-lvalues ((x a) y)
      (do-reversible (print-tree x y))
      (format t "tree string of ~a is ~a~%" a (lvalue-value y)))
    (with-lvalues (x (y b))
      (do-reversible (undo (print-tree x y)))
      (format t "tree parse of ~a is ~a~%" b (lvalue-value x)))))
  
       

       
         
