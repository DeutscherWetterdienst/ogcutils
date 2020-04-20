
.PHONY: login publish

all: login publish

login:
	@npm login

publish:
	@npm publish --access public