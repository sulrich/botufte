CSS_SRC := assets/css/style.scss
CSS_OUT := assets/css/style.css

.PHONY: css watch help

css: ## compile scss -> committed css (compressed). run after editing any .scss
	sass $(CSS_SRC) $(CSS_OUT) --style=compressed --no-source-map

watch: ## recompile css on every scss change (dev)
	sass --watch $(CSS_SRC):$(CSS_OUT) --style=compressed --no-source-map

hooks: ## enable the repo git hooks (auto-recompiles css on commit)
	git config core.hooksPath .githooks

help: ## show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  make %-7s %s\n", $$1, $$2}'
